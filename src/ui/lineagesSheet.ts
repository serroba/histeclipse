/**
 * Life through time (#358): a fossil group's genera as a radial tree of time, after the
 * fan-shaped trees of life (Hug et al. 2016). The group starts at the centre; time runs out to
 * the rim, the geological periods as rings. Each genus is a spoke from its first fossil to its
 * last, branches join it to its family and order, and each large group is a fan of its own
 * colour, named at the rim. A playhead ring sweeps outward: inside it, what had happened by
 * then; on it, the genera living then; and beside the tree, the map of that moment with those
 * genera where their finds lay. Picking a genus or a group lights its line back to the centre.
 *
 * Drawn on 2D canvases. DOM glue, covered by the Playwright suite; the layout and the placing in
 * time and space are in `data/lineages.ts`.
 */

import {
  aliveAt,
  ancestry,
  colourGroups,
  fanLayout,
  isGenus,
  isWithin,
  LINEAGE_GROUPS,
  origins,
  sitesAt,
  type Fan,
  type LineageGroup,
  type Lineages,
  type Origin,
  type Place,
} from '../data/lineages';
import { PERIODS } from '../deepTime/periods';
import type { LineagesView } from '../state/viewState';
import { elementAt, valueAt } from '../util/arrays';
import { errorMessage } from '../util/errors';
import { element } from './dom';

export interface LineagesSheet {
  readonly dialog: HTMLDialogElement;
  /** Open at a group, perhaps one of its names picked out, or close (null). */
  show(view: LineagesView | null): void;
}

/** The elevation maps' step and reach (Ma), as `public/data/paleodem/` holds them. */
const MAP_STEP_MA = 5;
const MAP_REACH_MA = 540;
/** One colour per colour group, as `colourGroups` numbers them; the legend's swatches match. */
const PALETTE = [
  '#ff8a3d',
  '#4cc9f0',
  '#90be6d',
  '#f15bb5',
  '#ffd166',
  '#a26cf0',
  '#43aa8b',
  '#f94144',
] as const;
/** The colour of lines in no colour group: the key's "Others". */
const OTHERS = '#8a93a8';
const GROUP_NAMES: Readonly<Record<LineageGroup, string>> = {
  trilobites: 'Trilobites',
  ammonoids: 'Ammonoids',
  dinosaurs: 'Dinosaurs',
  mammals: 'Mammals',
};
/** Seconds to play a group from its first line to its last. */
const PLAY_SECONDS = 24;
/** The centre's radius, so the first branches have room (a share of the rim's). */
const CORE = 0.05;
/** The rim's radius as a share of half the canvas, leaving room for the names round it. */
const REACH = 0.78;
/** How near (CSS pixels) a pointer must come to a line to pick it. */
const NEAR = 7;

interface Loaded {
  readonly lineages: Lineages;
  readonly starts: readonly Origin[];
  readonly colour: readonly number[];
  readonly heads: readonly number[];
  readonly genera: readonly number[];
  readonly fan: Fan;
  /** The genera's angles round the circle, in order, for finding the one under the pointer. */
  readonly roundAngles: readonly number[];
  /** The oldest and youngest moments the group's lines reach (Ma). */
  readonly oldest: number;
  readonly youngest: number;
  readonly byPbdb: ReadonlyMap<number, number>;
  /** The tree's lines and fans in unit coordinates, one path per colour group (-1 first). */
  readonly branches: readonly Path2D[];
  readonly lives: readonly Path2D[];
  readonly fans: readonly Path2D[];
  /** The middle of each colour group's own genera round the circle, where its name goes. */
  readonly middles: readonly number[];
}

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
  /** The maps of each moment, coloured, as they load; and the step shown. */
  const maps = new Map<number, Promise<HTMLCanvasElement>>();
  let mapImage: HTMLCanvasElement | null = null;
  let mapStep = -1;

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
    loadMap(at);
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

  // ---- The fan ----

  /** The fan's scale (CSS pixels per unit radius) and centre. */
  function frameOf(): { scale: number; cx: number; cy: number; width: number; height: number } {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    return {
      scale: (Math.min(width, height) / 2) * REACH * zoom,
      cx: width / 2 + panX,
      cy: height / 2 + panY,
      width,
      height,
    };
  }

  function draw(): void {
    drawFan();
    drawMap();
    placeTip();
  }

  function drawFan(): void {
    const context = fit(canvas);
    const data = current;
    if (context === null || data === null) return;
    const { scale, cx, cy, width, height } = frameOf();
    context.fillStyle = '#040812';
    context.fillRect(0, 0, width, height);
    const ratio = window.devicePixelRatio || 1;
    const px = 1 / scale;
    const now = rOf(data, at);
    context.setTransform(ratio * scale, 0, 0, ratio * scale, ratio * cx, ratio * cy);

    // The periods as rings, shaded in turn.
    let shade = false;
    for (const { outer, inner } of periodRings(data)) {
      shade = !shade;
      context.beginPath();
      context.arc(0, 0, outer, 0, 2 * Math.PI);
      context.arc(0, 0, inner, 0, 2 * Math.PI, true);
      context.fillStyle = shade ? 'rgba(120, 150, 210, 0.07)' : 'rgba(120, 150, 210, 0.025)';
      context.fill();
      context.beginPath();
      context.arc(0, 0, outer, 0, 2 * Math.PI);
      context.lineWidth = px;
      context.strokeStyle = 'rgba(160, 185, 230, 0.16)';
      context.stroke();
    }

    // The future, faint: the shape of what is to come.
    context.globalAlpha = 0.13;
    paintTree(context, data, px);
    context.globalAlpha = 1;
    // The past, inside the playhead ring.
    context.save();
    context.beginPath();
    context.arc(0, 0, now, 0, 2 * Math.PI);
    context.clip();
    if (picked >= 0) context.globalAlpha = 0.4;
    paintTree(context, data, px);
    context.globalAlpha = 1;
    if (pickedPath !== null) {
      context.lineWidth = 2.4 * px;
      context.strokeStyle = '#ffffff';
      context.stroke(pickedPath);
    }
    context.restore();

    // The playhead ring, and the genera living then on it.
    context.beginPath();
    context.arc(0, 0, now, 0, 2 * Math.PI);
    context.lineWidth = 1.6 * px;
    context.strokeStyle = 'rgba(255, 220, 170, 0.75)';
    context.stroke();
    const dot = Math.min(3.2, 1.8 * Math.sqrt(zoom)) * px;
    for (const index of living) {
      const angle = valueAt(data.fan.angle, index);
      const dimmed = picked >= 0 && !isWithin(data.lineages, index, picked);
      context.beginPath();
      context.arc(now * Math.cos(angle), now * Math.sin(angle), dot, 0, 2 * Math.PI);
      context.fillStyle = dimmed ? '#3a4560' : colourOf(data, index);
      context.fill();
    }

    // Words, in screen pixels: the periods in the opening at the top, the groups round the rim.
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.textBaseline = 'middle';
    context.textAlign = 'center';
    context.font = '10px system-ui, sans-serif';
    for (const { name, outer, inner } of periodRings(data)) {
      const y = ((outer + inner) / 2) * scale;
      // Not where the moment is named, at the top of its ring.
      if ((outer - inner) * scale < 11 || Math.abs(y - (now * scale + 9)) < 12) continue;
      halo(context, name, cx, cy - y, 'rgba(190, 205, 235, 0.75)');
    }
    context.font = '600 12px system-ui, sans-serif';
    data.heads.forEach((head, colour) => {
      const angle = valueAt(data.middles, colour);
      const reach = 1.03 * scale;
      const flip = Math.cos(angle) < 0;
      context.save();
      context.translate(cx + reach * Math.cos(angle), cy + reach * Math.sin(angle));
      context.rotate(flip ? angle + Math.PI : angle);
      context.textAlign = flip ? 'right' : 'left';
      const related =
        picked < 0 ||
        isWithin(data.lineages, head, picked) ||
        isWithin(data.lineages, picked, head);
      context.fillStyle = related ? (PALETTE[colour] ?? OTHERS) : 'rgba(160, 170, 190, 0.5)';
      context.fillText(elementAt(data.lineages.nodes, head).name, 0, 0);
      context.restore();
    });
    // The moment, at the top of its ring.
    context.textAlign = 'center';
    context.font = '600 11px system-ui, sans-serif';
    halo(
      context,
      at < 0.5 ? 'Today' : `${String(Math.round(at))} Ma`,
      cx,
      cy - now * scale - 9,
      '#ffdcaa',
    );
    if (picked >= 0) pinName(context, data, scale, cx, cy);
  }

  /** The picked name, on a white tab where its line is at the playhead (or ends). */
  function pinName(
    context: CanvasRenderingContext2D,
    data: Loaded,
    scale: number,
    cx: number,
    cy: number,
  ): void {
    const node = elementAt(data.lineages.nodes, picked);
    const angle = valueAt(data.fan.angle, picked);
    const r = rOf(data, Math.max(Math.min(at, node.first), node.last)) * scale;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    context.font = '600 12px system-ui, sans-serif';
    context.textAlign = 'left';
    const wide = context.measureText(node.name).width;
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.roundRect(x + 8, y - 9, wide + 10, 18, 6);
    context.arc(x, y, 3.5, 0, 2 * Math.PI);
    context.fill();
    context.fillStyle = '#0a1020';
    context.fillText(node.name, x + 13, y);
  }

  function paintTree(context: CanvasRenderingContext2D, data: Loaded, px: number): void {
    data.fans.forEach((path, slot) => {
      context.fillStyle = withAlpha(slot - 1, 0.2);
      context.fill(path);
    });
    context.lineWidth = 0.7 * px;
    data.branches.forEach((path, slot) => {
      context.strokeStyle = withAlpha(slot - 1, 0.55);
      context.stroke(path);
    });
    context.lineWidth = 1.2 * px;
    data.lives.forEach((path, slot) => {
      context.strokeStyle = withAlpha(slot - 1, 0.95);
      context.stroke(path);
    });
  }

  /** The picked node's lines: its members' and its line back to the centre. */
  function litPath(data: Loaded, index: number): Path2D {
    const path = new Path2D();
    for (const node of data.lineages.nodes) {
      if (
        isWithin(data.lineages, node.index, index) ||
        isWithin(data.lineages, index, node.index)
      ) {
        traceNode(data, node.index, path, path);
      }
    }
    return path;
  }

  /** The node (genus, or group by its name at the rim) at a point on the fan, if near enough. */
  function genusAtFan(x: number, y: number): number | undefined {
    const data = current;
    if (data === null) return undefined;
    const { scale, cx, cy } = frameOf();
    const ux = (x - cx) / scale;
    const uy = (y - cy) / scale;
    const r = Math.hypot(ux, uy);
    let angle = Math.atan2(uy, ux);
    if (angle < -Math.PI / 2) angle += 2 * Math.PI;
    const tolerance = NEAR / scale;
    if (r > 1 + tolerance) {
      return data.heads.find(
        (each) =>
          angle >= valueAt(data.fan.low, each) - 0.01 &&
          angle <= valueAt(data.fan.high, each) + 0.01,
      );
    }
    const angles = data.roundAngles;
    let low = 0;
    let high = angles.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (valueAt(angles, middle) < angle) low = middle + 1;
      else high = middle;
    }
    const now = rOf(data, at);
    let best: number | undefined;
    let nearest = NEAR;
    for (let slot = Math.max(0, low - 8); slot < Math.min(angles.length, low + 8); slot++) {
      const index = valueAt(data.fan.round, slot);
      const node = elementAt(data.lineages.nodes, index);
      const inner = rOf(data, node.first) - tolerance;
      const outer = Math.min(rOf(data, node.last), now) + tolerance;
      if (r < inner || r > outer) continue;
      const away = Math.abs(valueAt(angles, slot) - angle) * r * scale;
      if (away < nearest) {
        nearest = away;
        best = index;
      }
    }
    return best;
  }

  // ---- The map of the moment ----

  function loadMap(ma: number): void {
    const step = Math.min(MAP_REACH_MA, Math.max(0, Math.round(ma / MAP_STEP_MA) * MAP_STEP_MA));
    if (step === mapStep) return;
    mapStep = step;
    let made = maps.get(step);
    if (made === undefined) {
      made = paint(floorUrl(step), 720, 360);
      made.catch(() => maps.delete(step));
      maps.set(step, made);
    }
    made.then(
      (painted) => {
        if (mapStep !== step) return;
        mapImage = painted;
        drawMap();
      },
      () => {
        // The map stays as it was; the dots still read without it.
      },
    );
  }

  function mapXy(place: Place): readonly [number, number] {
    return [
      ((place.longitude + 180) / 360) * mapCanvas.clientWidth,
      ((90 - place.latitude) / 180) * mapCanvas.clientHeight,
    ];
  }

  function drawMap(): void {
    const context = fit(mapCanvas);
    const data = current;
    if (context === null || data === null) return;
    const width = mapCanvas.clientWidth;
    const height = mapCanvas.clientHeight;
    context.fillStyle = '#0a1428';
    context.fillRect(0, 0, width, height);
    if (mapImage !== null) context.drawImage(mapImage, 0, 0, width, height);
    // Every site the picked genus was found at, faint, each where its plate carried it then.
    const node = picked >= 0 ? elementAt(data.lineages.nodes, picked) : null;
    if (node !== null) {
      context.fillStyle = 'rgba(255, 255, 255, 0.45)';
      for (const site of node.track) {
        const [x, y] = mapXy(site);
        context.beginPath();
        context.arc(x, y, 1.6, 0, 2 * Math.PI);
        context.fill();
      }
    }
    for (const index of living) {
      const { sites, found } = sitesAt(
        elementAt(data.lineages.nodes, index).track,
        at,
        data.lineages.stepMa,
      );
      const dimmed = picked >= 0 && !isWithin(data.lineages, index, picked);
      const colour = dimmed ? 'rgba(70, 85, 115, 0.8)' : colourOf(data, index);
      for (const site of sites) {
        const [x, y] = mapXy(site);
        context.beginPath();
        context.arc(x, y, index === picked ? 4.5 : found ? 2.4 : 2, 0, 2 * Math.PI);
        // Found in this step: filled. Not found then: a ring where it was last found.
        if (found) {
          context.fillStyle = colour;
          context.fill();
        } else {
          context.lineWidth = 1;
          context.strokeStyle = colour;
          context.stroke();
        }
        if (index === picked) {
          context.lineWidth = 1.5;
          context.strokeStyle = '#ffffff';
          context.stroke();
        }
      }
    }
  }

  function genusAtMap(x: number, y: number): number | undefined {
    const data = current;
    if (data === null) return undefined;
    let best: number | undefined;
    let nearest = NEAR;
    for (const index of living) {
      for (const site of sitesAt(
        elementAt(data.lineages.nodes, index).track,
        at,
        data.lineages.stepMa,
      ).sites) {
        const [dx, dy] = mapXy(site);
        const away = Math.hypot(dx - x, dy - y);
        if (away < nearest) {
          nearest = away;
          best = index;
        }
      }
    }
    return best;
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
      const index = genusAtFan(point.x, point.y);
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
    pickAt(genusAtFan(was.x, was.y));
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
    const index = genusAtMap(point.x, point.y);
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
    pickAt(genusAtMap(point.x, point.y));
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
          mapStep = -1;
          mapImage = null;
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

/** Lay a group's tree round the circle, and trace its lines and fans once. */
function arrange(lineages: Lineages): Loaded {
  const { heads, colour } = colourGroups(lineages, PALETTE.length);
  const genera = lineages.nodes.filter(isGenus).map((node) => node.index);
  let youngest = Infinity;
  for (const index of genera) youngest = Math.min(youngest, elementAt(lineages.nodes, index).last);
  const fan = fanLayout(lineages, colour);
  const slots = PALETTE.length + 1;
  const data: Loaded = {
    lineages,
    starts: origins(lineages),
    colour,
    heads,
    genera,
    fan,
    roundAngles: fan.round.map((index) => valueAt(fan.angle, index)),
    oldest: elementAt(lineages.nodes, 0).first,
    youngest: Number.isFinite(youngest) ? youngest : 0,
    byPbdb: new Map(lineages.nodes.map((node) => [node.pbdb, node.index] as const)),
    branches: Array.from({ length: slots }, () => new Path2D()),
    lives: Array.from({ length: slots }, () => new Path2D()),
    fans: Array.from({ length: slots }, () => new Path2D()),
    middles: heads.map((_, at) => {
      const own = fan.round.filter((genus) => valueAt(colour, genus) === at);
      const first = own[0];
      const last = own.at(-1);
      return first === undefined || last === undefined
        ? 0
        : (valueAt(fan.angle, first) + valueAt(fan.angle, last)) / 2;
    }),
  };
  for (const node of lineages.nodes) {
    const slot = valueAt(colour, node.index) + 1;
    traceNode(data, node.index, elementAt(data.branches, slot), elementAt(data.lives, slot));
  }
  // Each colour group's fan: from where it branches, out along its genera's last fossils.
  heads.forEach((head, at) => {
    const path = elementAt(data.fans, at + 1);
    const from = rOf(data, elementAt(lineages.nodes, head).first);
    const angle = valueAt(data.middles, at);
    path.moveTo(from * Math.cos(angle), from * Math.sin(angle));
    for (const genus of fan.round) {
      if (valueAt(colour, genus) !== at) continue;
      const r = rOf(data, elementAt(lineages.nodes, genus).last);
      const turn = valueAt(fan.angle, genus);
      path.lineTo(r * Math.cos(turn), r * Math.sin(turn));
    }
    path.closePath();
  });
  return data;
}

/** A node's branch from its parent (along the parent's ring, then out) and, for a genus, its life. */
function traceNode(data: Loaded, index: number, branch: Path2D, life: Path2D): void {
  const node = elementAt(data.lineages.nodes, index);
  const angle = valueAt(data.fan.angle, index);
  const start = rOf(data, node.first);
  if (node.parent >= 0) {
    const from = rOf(data, elementAt(data.lineages.nodes, node.parent).first);
    const turn = valueAt(data.fan.angle, node.parent);
    branch.moveTo(from * Math.cos(turn), from * Math.sin(turn));
    if (Math.abs(turn - angle) > 1e-9) branch.arc(0, 0, from, turn, angle, angle < turn);
    branch.lineTo(start * Math.cos(angle), start * Math.sin(angle));
  }
  if (isGenus(node)) {
    const end = rOf(data, node.last);
    life.moveTo(start * Math.cos(angle), start * Math.sin(angle));
    life.lineTo(end * Math.cos(angle), end * Math.sin(angle));
  }
}

/** A moment's radius: the group's start at the core, its last fossils (or today) at the rim. */
function rOf(data: Pick<Loaded, 'oldest' | 'youngest'>, ma: number): number {
  const spanMa = data.oldest - data.youngest;
  return spanMa <= 0 ? 1 : CORE + ((1 - CORE) * (data.oldest - ma)) / spanMa;
}

/** The geological periods the group lived through, as rings (radii) with their names. */
function periodRings(
  data: Loaded,
): readonly { readonly name: string; readonly outer: number; readonly inner: number }[] {
  const out: { name: string; outer: number; inner: number }[] = [];
  PERIODS.forEach((period, index) => {
    const top = index === 0 ? 0 : elementAt(PERIODS, index - 1).base;
    if (period.base <= data.youngest || top >= data.oldest) return;
    out.push({
      name: period.name,
      outer: rOf(data, Math.max(top, data.youngest)),
      inner: rOf(data, Math.min(period.base, data.oldest)),
    });
  });
  return out;
}

function colourOf(data: Loaded, index: number): string {
  return PALETTE[valueAt(data.colour, index)] ?? OTHERS;
}

/** Size a canvas's backing store to its box at the screen's pixel ratio; draw in CSS pixels. */
function fit(target: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(target.clientWidth * ratio));
  const height = Math.max(1, Math.round(target.clientHeight * ratio));
  if (target.width !== width || target.height !== height) {
    target.width = width;
    target.height = height;
  }
  const context = target.getContext('2d');
  context?.setTransform(ratio, 0, 0, ratio, 0, 0);
  return context;
}

function local(event: MouseEvent, target: HTMLElement): { x: number; y: number } {
  const box = target.getBoundingClientRect();
  return { x: event.clientX - box.left, y: event.clientY - box.top };
}

/** Text with a dark edge, so it reads over the lines. */
function halo(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  colour: string,
): void {
  context.lineWidth = 3;
  context.strokeStyle = 'rgba(4, 8, 18, 0.9)';
  context.strokeText(text, x, y);
  context.fillStyle = colour;
  context.fillText(text, x, y);
}

/** A colour group's colour (-1: the others) at an opacity. */
function withAlpha(colour: number, alpha: number): string {
  const hex = PALETTE[colour] ?? OTHERS;
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(alpha)})`;
}

/**
 * The elevation map at `url` as a coloured picture: sea floor in blues, deeper darker; land in
 * greens and browns, higher lighter. Bytes below 128 are sea, as the pipeline packs them.
 */
async function paint(url: string, width: number, height: number): Promise<HTMLCanvasElement> {
  const image = new Image();
  image.src = url;
  await image.decode();
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const context = out.getContext('2d', { willReadFrequently: true });
  if (context === null) return out;
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  const bytes = pixels.data;
  for (let at = 0; at < bytes.length; at += 4) {
    const level = bytes[at] ?? 0;
    if (level < 128) {
      const deep = level / 127;
      bytes[at] = 8 + 14 * deep;
      bytes[at + 1] = 18 + 34 * deep;
      bytes[at + 2] = 40 + 60 * deep;
    } else {
      const high = (level - 128) / 127;
      bytes[at] = 62 + 120 * high;
      bytes[at + 1] = 84 + 80 * high;
      bytes[at + 2] = 52 + 60 * high;
    }
    bytes[at + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  return out;
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
