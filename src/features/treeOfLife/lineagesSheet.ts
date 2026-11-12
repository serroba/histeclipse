/**
 * Life through time (#358): a fossil group's genera as a radial tree of time, after the
 * fan-shaped trees of life (Hug et al. 2016). The group starts at the centre; time runs out to
 * the rim, the geological periods as rings. Each genus is a spoke from its first fossil to its
 * last, branches join it to its family and order, and each large group is a fan of its own
 * colour, named at the rim. A playhead ring sweeps outward: inside it, what had happened by
 * then; on it, the genera living then; and beside the tree, the map of that moment with those
 * genera where their finds lay. Picking a genus or a group lights its line back to the centre.
 * Drawn on 2D canvases. DOM glue, covered by the Playwright suite; the layout and the placing in
 * time and space are in `data/lineages.ts`.
 */

import {
  aliveAt,
  ancestry,
  isGenus,
  isWithin,
  LINEAGE_GROUPS,
  type LineageGroup,
  type Lineages,
  type Place,
} from '../../data/lineages';
import type { LineagesView } from '../../state/viewState';
import { elementAt } from '../../util/arrays';
import { errorMessage } from '../../util/errors';
import { element } from '../../ui/dom';
import { drawFan, genusAtFan, litPath } from './lineagesFan';
import { createMomentMap } from './lineagesMap';
import { arrange, type Loaded, type Moment } from './lineagesTree';
import '../../ui/stageSheet.css';

export interface LineagesSheet {
  readonly dialog: HTMLDialogElement;
  /** Open at a group, perhaps one of its names picked out, or close (null). */
  show(view: LineagesView | null): void;
}

const GROUP_NAMES: Readonly<Record<LineageGroup, string>> = {
  trilobites: 'Trilobites',
  ammonoids: 'Ammonoids',
  dinosaurs: 'Dinosaurs',
  mammals: 'Mammals',
};
/** Seconds to play a group from its first line to its last. */
const PLAY_SECONDS = 24;
/** Where the pointer is over a canvas, and the genus under it, for the tooltip. */
interface Hover {
  readonly x: number;
  readonly y: number;
  readonly index: number;
}

export function createLineagesSheet(
  /** Asked to open at a group, perhaps a name picked out, or to close: the view decides. */
  onRequest: (view: LineagesView | null) => void,
  /** A group's lines, loaded the first time it is shown. */
  load: (group: LineageGroup) => Promise<Lineages>,
  /** The elevation map's url for a moment (Ma, a multiple of 5 up to 540). */
  floorUrl: (ma: number) => string,
  /** Go to deep time at a moment, facing a place, with the fossils showing. */
  onGlobe: (ma: number, where: Place) => void,
  /** The book that says where the lines come from. */
  why: HTMLElement,
): LineagesSheet {
  const close = element(
    'button',
    { type: 'button', class: 'famous-close', 'aria-label': 'Close' },
    '×',
  );
  const groupButtons = new Map<LineageGroup, HTMLButtonElement>(
    LINEAGE_GROUPS.map((group) => {
      const button = element(
        'button',
        { type: 'button', class: 'stage-switch-option', 'aria-pressed': 'false' },
        GROUP_NAMES[group],
      );
      button.addEventListener('click', () => {
        onRequest({ group, pick: null });
      });
      return [group, button] as const;
    }),
  );
  const switcher = element(
    'div',
    { class: 'stage-switch', role: 'group', 'aria-label': 'Which animals' },
    ...groupButtons.values(),
  );
  const play = element(
    'button',
    {
      type: 'button',
      class: 'lineages-play',
      'aria-label': 'Play',
      'data-testid': 'lineages-play',
    },
    '▶',
  );
  const slider = element('input', {
    type: 'range',
    class: 'lineages-slider',
    'aria-label': 'Million years ago',
    'data-testid': 'lineages-slider',
    step: '0.5',
  });
  const moment = element('span', { class: 'lineages-moment', 'aria-live': 'off' });
  const clock = element('div', { class: 'lineages-clock' }, play, slider, moment);
  const status = element('p', { class: 'stage-status', role: 'status' }, 'Loading the tree…');
  const legend = element('div', { class: 'stage-legend stage-key' });
  const canvas = element('canvas', {
    class: 'lineages-fan',
    'data-testid': 'lineages-canvas',
    'aria-label':
      'The tree through time: the group starts at the centre and time runs outward, the ring is the slider’s moment. Drag to move, scroll or pinch to zoom, double-click to fit',
  });
  const mapCanvas = element('canvas', {
    class: 'lineages-map',
    'data-testid': 'lineages-map',
    'aria-label':
      'The world at the slider’s moment, with the genera then living where their finds lay',
  });
  const mapCaption = element('p', { class: 'lineages-map-caption' });
  const tip = element('div', { class: 'lineages-tip', role: 'tooltip', hidden: '' });
  const fanFrame = element('div', { class: 'lineages-fan-frame' }, canvas);
  const side = element(
    'div',
    { class: 'lineages-side' },
    element('div', { class: 'lineages-map-frame' }, mapCanvas),
    mapCaption,
    legend,
  );
  const stage = element('div', { class: 'lineages-stage' }, fanFrame, side, tip);
  const focus = element('div', { class: 'stage-focus', 'data-testid': 'lineages-focus' });
  const whole = element('button', { type: 'button', class: 'why-all' }, 'The whole group');
  const dialog = element(
    'dialog',
    { class: 'famous-dialog stage-sheet lineages-sheet', 'aria-labelledby': 'lineages-title' },
    element(
      'header',
      { class: 'famous-header' },
      element('h2', { id: 'lineages-title' }, 'Life through time ', why),
      close,
    ),
    element(
      'div',
      { class: 'stage-body' },
      element(
        'div',
        { class: 'stage-bar' },
        switcher,
        element(
          'p',
          { class: 'stage-how' },
          'The group starts at the centre; time runs outward, ring by geological period. Each spoke is a genus, from its first fossil to its last; branches join it to its family and order, and each colour is a branch of the tree. The bright ring is the moment: the dots on it are the genera then living, and the map shows where. Play to watch the tree grow.',
        ),
      ),
      stage,
      clock,
      status,
      focus,
      element(
        'p',
        { class: 'stage-note' },
        'From the Paleobiology Database’s classification and finds. A family or order branches when its oldest member first appears: an estimate from the fossils found, not a moment anyone saw. On the map a genus stands where it was found in each 5 million years, at each place apart (finds within 500 km are one), and nothing is drawn between: a genus found in Asia then in North America was found in both, not seen crossing. Footprints and eggs are left out.',
      ),
      element('div', { class: 'why-actions' }, whole),
    ),
  );
  close.addEventListener('click', () => {
    onRequest(null);
  });
  whole.addEventListener('click', () => {
    if (wanted !== null) onRequest({ group: wanted.group, pick: null });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dialog.open) onRequest(null);
  });

  const groups = new Map<LineageGroup, Promise<Loaded>>();
  let wanted: LineagesView | null = null;
  let shown = '';
  let current: Loaded | null = null;
  /** The picked node, -1 for none; and its lines, lit. */
  let picked = -1;
  let pickedPath: Path2D | null = null;
  /** The playhead (Ma), and whether it is moving towards the present. */
  let at = 0;
  let playing = false;
  let lastFrame = 0;
  let frameRequest = 0;
  /** The name picked when last drawn, to move the playhead only when the pick changes. */
  let lastPick: number | undefined;
  /** The view of the fan: zoom about the centre, and how far it is moved (CSS pixels). */
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let hover: Hover | null = null;
  let mapHover: Hover | null = null;
  let living: number[] = [];
  const map = createMomentMap(mapCanvas, floorUrl, () => {
    const now = momentNow();
    if (now !== null) map.draw(now);
  });

  slider.addEventListener('input', () => {
    playing = false;
    setMoment(-Number(slider.value));
  });
  play.addEventListener('click', () => {
    if (current === null) return;
    if (!playing && at <= current.youngest + 0.01) at = current.oldest;
    playing = !playing;
    setMoment(at);
  });

  function tick(time: number): void {
    frameRequest = 0;
    if (!playing || current === null || !dialog.open) {
      lastFrame = 0;
      return;
    }
    const seconds = lastFrame === 0 ? 0 : Math.min(0.1, (time - lastFrame) / 1000);
    lastFrame = time;
    const next = at - ((current.oldest - current.youngest) / PLAY_SECONDS) * seconds;
    if (next <= current.youngest) playing = false;
    setMoment(next);
  }

  function setMoment(ma: number): void {
    if (current === null) return;
    at = Math.min(current.oldest, Math.max(current.youngest, ma));
    slider.value = String(-at);
    play.textContent = playing ? '❚❚' : '▶';
    play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    const data = current;
    living = data.genera.filter((index) => aliveAt(elementAt(data.lineages.nodes, index), at));
    const when = at < 0.5 ? 'Today' : `${String(Math.round(at))} million years ago`;
    const genera = living.length === 1 ? '1 genus' : `${living.length.toLocaleString('en')} genera`;
    moment.textContent = `${when} · ${genera} living`;
    canvas.dataset['ma'] = at.toFixed(1);
    mapCaption.textContent = `The world ${when === 'Today' ? 'today' : when}, and where the ${genera} then living were found: filled in these 5 million years, a ring where last found`;
    map.load(at);
    draw();
    if (playing && frameRequest === 0) frameRequest = requestAnimationFrame(tick);
    if (!playing) lastFrame = 0;
  }

  function prepare(group: LineageGroup): Promise<Loaded> {
    let loading = groups.get(group);
    if (loading === undefined) {
      loading = load(group).then(arrange);
      loading.catch(() => groups.delete(group));
      groups.set(group, loading);
    }
    return loading;
  }

  /** The tree at the playhead, once a group has loaded. */
  function momentNow(): Moment | null {
    return current === null ? null : { data: current, at, picked, pickedPath, living };
  }

  function draw(): void {
    const now = momentNow();
    if (now !== null) {
      drawFan(canvas, now, { zoom, panX, panY });
      map.draw(now);
    }
    placeTip();
  }

  /** The node at a point on the fan, if near enough. */
  function fanAt(x: number, y: number): number | undefined {
    const now = momentNow();
    return now === null ? undefined : genusAtFan(canvas, now, { zoom, panX, panY }, x, y);
  }

  /** The living genus at a point on the map, if near enough. */
  function mapAt(x: number, y: number): number | undefined {
    const now = momentNow();
    return now === null ? undefined : map.genusAt(now, x, y);
  }

  // ---- Pointing, moving and zooming ----

  function placeTip(): void {
    const data = current;
    const over = hover ?? mapHover;
    if (data === null || over === null) {
      tip.hidden = true;
      return;
    }
    const node = elementAt(data.lineages.nodes, over.index);
    const kind = isGenus(node)
      ? `${familyOf(data.lineages, node.index) || 'Genus'} · ${String(node.species)} species`
      : `${capital(rankWord(node.rank))} of ${String(generaWithin(data, node.index))} genera`;
    tip.replaceChildren(
      element('strong', {}, node.name),
      element('span', {}, capital(span(node.first, node.last))),
      element('span', {}, kind),
    );
    const box = stage.getBoundingClientRect();
    const source = (hover === null ? mapCanvas : canvas).getBoundingClientRect();
    const left = Math.min(box.width - 190, over.x + source.left - box.left + 12);
    tip.style.left = `${String(Math.max(0, left))}px`;
    tip.style.top = `${String(over.y + source.top - box.top + 12)}px`;
    tip.hidden = false;
  }

  const pointers = new Map<number, { x: number; y: number }>();
  let dragged = 0;
  let pinch = 0;

  function zoomAbout(x: number, y: number, factor: number): void {
    const next = Math.min(40, Math.max(1, zoom * factor));
    const applied = next / zoom;
    const middleX = canvas.clientWidth / 2;
    const middleY = canvas.clientHeight / 2;
    // Keep the point under the pointer where it is.
    panX = x - middleX - (x - middleX - panX) * applied;
    panY = y - middleY - (y - middleY - panY) * applied;
    zoom = next;
    if (zoom === 1) {
      panX = 0;
      panY = 0;
    }
    draw();
  }

  function pickAt(index: number | undefined): void {
    if (index !== undefined && current !== null) {
      onRequest({
        group: current.lineages.id,
        pick: elementAt(current.lineages.nodes, index).pbdb,
      });
    }
  }

  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, local(event, canvas));
    dragged = 0;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = a !== undefined && b !== undefined ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    }
  });
  canvas.addEventListener('pointermove', (event) => {
    const point = local(event, canvas);
    const before = pointers.get(event.pointerId);
    if (before === undefined) {
      const index = fanAt(point.x, point.y);
      hover = index === undefined ? null : { ...point, index };
      canvas.style.cursor = index === undefined ? (zoom > 1 ? 'grab' : 'default') : 'pointer';
      placeTip();
      return;
    }
    pointers.set(event.pointerId, point);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      if (a === undefined || b === undefined) return;
      const apart = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch > 0) zoomAbout((a.x + b.x) / 2, (a.y + b.y) / 2, apart / pinch);
      pinch = apart;
      dragged += 10;
      return;
    }
    dragged += Math.hypot(point.x - before.x, point.y - before.y);
    if (zoom > 1) {
      panX += point.x - before.x;
      panY += point.y - before.y;
      hover = null;
      draw();
    }
  });
  const release = (event: PointerEvent): void => {
    const was = pointers.get(event.pointerId);
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = 0;
    if (was === undefined || dragged > 4 || event.type === 'pointercancel') return;
    pickAt(fanAt(was.x, was.y));
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', () => {
    hover = null;
    placeTip();
  });
  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      const point = local(event, canvas);
      zoomAbout(point.x, point.y, Math.exp(-event.deltaY * 0.0015));
    },
    { passive: false },
  );
  canvas.addEventListener('dblclick', () => {
    zoom = 1;
    panX = 0;
    panY = 0;
    draw();
  });
  mapCanvas.addEventListener('pointermove', (event) => {
    const point = local(event, mapCanvas);
    const index = mapAt(point.x, point.y);
    mapHover = index === undefined ? null : { ...point, index };
    mapCanvas.style.cursor = index === undefined ? 'default' : 'pointer';
    placeTip();
  });
  mapCanvas.addEventListener('pointerleave', () => {
    mapHover = null;
    placeTip();
  });
  mapCanvas.addEventListener('click', (event) => {
    const point = local(event, mapCanvas);
    pickAt(mapAt(point.x, point.y));
  });
  new ResizeObserver(() => {
    if (dialog.open) draw();
  }).observe(stage);

  // ---- The words under the tree ----

  function describe(data: Loaded, index: number | undefined): void {
    if (index === undefined) {
      focus.replaceChildren(
        element(
          'p',
          { class: 'stage-note' },
          `${data.lineages.name}: ${data.genera.length.toLocaleString('en')} genera, ${span(data.oldest, data.youngest)}. Pick a spoke, a dot or a name round the rim to follow it.`,
        ),
      );
      return;
    }
    const node = elementAt(data.lineages.nodes, index);
    const line = ancestry(data.lineages, index);
    const crumbs = element(
      'ol',
      { class: 'tree-lineage', 'aria-label': 'Its line back to the group' },
      ...line.map((each) => {
        const button = element('button', { type: 'button', class: 'tree-crumb' }, each.name);
        button.addEventListener('click', () => {
          onRequest({ group: data.lineages.id, pick: each.pbdb });
        });
        return element('li', {}, button);
      }),
    );
    const start = elementAt(data.starts, index);
    const globe = element(
      'button',
      { type: 'button', class: 'why-all' },
      `See its fossils on the globe, ${String(Math.round(node.first))} million years ago`,
    );
    globe.addEventListener('click', () => {
      onGlobe(node.first, start);
    });
    const more = element(
      'a',
      {
        class: 'why-all',
        href: `https://paleobiodb.org/classic/basicTaxonInfo?taxon_no=${String(node.pbdb)}`,
        target: '_blank',
        rel: 'noopener',
      },
      'Its page in the Paleobiology Database',
    );
    const kind = isGenus(node)
      ? `Genus, ${String(node.species)} species named`
      : `${capital(rankWord(node.rank))} of ${String(generaWithin(data, index))} genera here`;
    focus.replaceChildren(
      element('h3', {}, node.name),
      element('p', { class: 'stage-note' }, `${kind}. ${capital(span(node.first, node.last))}.`),
      crumbs,
      element('div', { class: 'why-actions' }, globe, more),
    );
  }

  function render(): void {
    if (wanted === null) return;
    const view = wanted;
    void prepare(view.group).then(
      (data) => {
        if (wanted !== view) return;
        status.hidden = true;
        if (current !== data) {
          current = data;
          zoom = 1;
          panX = 0;
          panY = 0;
          map.reset();
          canvas.dataset['genera'] = String(data.genera.length);
          canvas.dataset['group'] = data.lineages.id;
          slider.min = String(-data.oldest);
          slider.max = String(-data.youngest);
          legend.replaceChildren(
            ...data.heads.flatMap((head, colour) => [
              element('span', { class: `stage-key-swatch lineage-swatch-${String(colour)}` }),
              elementAt(data.lineages.nodes, head).name,
            ]),
            ...(data.colour.some((colour, index) => colour === -1 && index > 0)
              ? [element('span', { class: 'stage-key-swatch lineage-swatch-other' }), 'Others']
              : []),
          );
          // A new group grows from its start, unless motion is unwelcome or a name is picked
          // (then its whole line shows, below).
          const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          playing = !still && view.pick === null;
          at = playing ? data.oldest : data.youngest;
        }
        const index = view.pick === null ? undefined : data.byPbdb.get(view.pick);
        picked = index ?? -1;
        pickedPath = index === undefined ? null : litPath(data, index);
        if (index !== undefined && index !== lastPick) {
          // A newly picked name's line shows whole: the playhead at its last appearance.
          playing = false;
          at = elementAt(data.lineages.nodes, index).last;
        }
        lastPick = index;
        setMoment(at);
        describe(data, index);
      },
      (error: unknown) => {
        shown = '';
        status.hidden = false;
        status.textContent = `Could not draw the tree: ${errorMessage(error)}`;
      },
    );
  }

  function show(view: LineagesView | null): void {
    const key = view === null ? '' : `${view.group}:${String(view.pick)}`;
    if (key === shown) return;
    shown = key;
    if (view === null) {
      wanted = null;
      playing = false;
      if (dialog.open) dialog.close();
      return;
    }
    wanted = view;
    for (const [group, button] of groupButtons) {
      button.setAttribute('aria-pressed', String(group === view.group));
    }
    if (!dialog.open) dialog.show();
    if (current?.lineages.id !== view.group) status.hidden = false;
    render();
  }

  return { dialog, show };
}

function local(event: MouseEvent, target: HTMLElement): { x: number; y: number } {
  const box = target.getBoundingClientRect();
  return { x: event.clientX - box.left, y: event.clientY - box.top };
}

function span(first: number, last: number): string {
  const from = `${formatMa(first)} million years ago`;
  return last <= 0 ? `from ${from} to today` : `from ${from} to ${formatMa(last)}`;
}

function formatMa(ma: number): string {
  return ma >= 10 ? String(Math.round(ma)) : String(Math.round(ma * 10) / 10);
}

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function rankWord(rank: string): string {
  return rank === 'clade' ? 'group' : rank;
}

/** The nearest family above a genus, or its parent's name if none is a family. */
function familyOf(lineages: Lineages, index: number): string {
  const line = ancestry(lineages, index);
  const family = [...line].reverse().find((node) => node.rank === 'family');
  return family?.name ?? line.at(-2)?.name ?? '';
}

function generaWithin(data: Loaded, index: number): number {
  return data.genera.filter((genus) => isWithin(data.lineages, genus, index)).length;
}
