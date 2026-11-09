/**
 * Life through time (#358): a fossil group's genera as lines rising through time over the map
 * of each age. The floor is the playhead: the world at that moment (PALEOMAP's elevation map),
 * the genera then living as dots on it where their finds lay, and below it everything that had
 * happened by then: each genus's line from its first appearance, drifting with its plate, and
 * the branches joining it to its family and order. Play grows the tree; the slider scrubs it.
 * Picking a genus or a group lights its line back to the group and dims the rest.
 *
 * phoria2 draws it, loaded only when the sheet first opens. DOM and WebGL glue, covered by the
 * Playwright suite; the placing in time and space is in `data/lineages.ts`.
 */

import type * as Phoria2 from 'phoria2';

import {
  aliveAt,
  ancestry,
  colourGroups,
  isGenus,
  isWithin,
  LINEAGE_GROUPS,
  origins,
  strokes,
  strokeUntil,
  trackAt,
  type LineageGroup,
  type Lineages,
  type Origin,
  type Place,
  type Stroke,
} from '../data/lineages';
import type { LineagesView } from '../state/viewState';
import { elementAt, valueAt } from '../util/arrays';
import { errorMessage } from '../util/errors';
import { element } from './dom';

export interface LineagesSheet {
  readonly dialog: HTMLDialogElement;
  /** Open at a group, perhaps one of its names picked out, or close (null). */
  show(view: LineagesView | null): void;
}

type Phoria = typeof Phoria2;
type Xyz = readonly [number, number, number];

/** The box: longitude across, time up, latitude in depth. */
const BOX: Xyz = [12, 7, 6];
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

interface Loaded {
  readonly lineages: Lineages;
  readonly strokes: readonly Stroke[];
  /** Where and when each line starts. */
  readonly starts: readonly Origin[];
  readonly colour: readonly number[];
  readonly heads: readonly number[];
  readonly genera: readonly number[];
  /** The oldest and youngest moments the group's lines reach (Ma). */
  readonly oldest: number;
  readonly youngest: number;
  readonly byPbdb: ReadonlyMap<number, number>;
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
  const status = element('p', { class: 'stage-status', role: 'status' }, 'Loading the lines…');
  const legend = element('div', { class: 'stage-legend stage-key' });
  const canvas = element('canvas', {
    class: 'stage-canvas',
    'data-testid': 'lineages-canvas',
    'aria-label':
      'Genera through time: time rises, the floor is the world at the slider’s moment. Drag to turn, scroll to zoom',
  });
  const view3d = element('div', { class: 'stage-view' });
  const frame = element('div', { class: 'stage-frame' }, view3d, legend);
  const focus = element('div', { class: 'stage-focus', 'data-testid': 'lineages-focus' });
  const whole = element('button', { type: 'button', class: 'why-all' }, 'The whole group');
  const dialog = element(
    'dialog',
    { class: 'famous-dialog stage-sheet', 'aria-labelledby': 'lineages-title' },
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
          'Time rises; the floor is the world at the slider’s moment. Each line is a genus, from its first fossil to its last, drifting with its plate; branches join it to its family and order. Dots are the genera living then. Play to watch the group grow.',
        ),
      ),
      frame,
      clock,
      status,
      focus,
      element(
        'p',
        { class: 'stage-note' },
        'From the Paleobiology Database’s classification and finds. A genus stands where its finds lay, every 5 million years; between finds its place is drawn part way. A family or order starts where and when its oldest member does: an estimate from the fossils found, not a moment anyone saw. Footprints and eggs are left out.',
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

  let phoria: Phoria | null = null;
  let starting: Promise<Phoria> | null = null;
  const groups = new Map<LineageGroup, Promise<Loaded>>();
  let wanted: LineagesView | null = null;
  let shown = '';
  let scene: ReturnType<typeof build> | null = null;
  let current: Loaded | null = null;
  /** The playhead (Ma), and whether it is moving towards the present. */
  let at = 0;
  let playing = false;
  /** The name picked when last drawn, to move the playhead only when the pick changes. */
  let lastPick: number | undefined;

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

  function setMoment(ma: number): void {
    if (current === null) return;
    at = Math.min(current.oldest, Math.max(current.youngest, ma));
    slider.value = String(-at);
    play.textContent = playing ? '❚❚' : '▶';
    play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    scene?.moment(at);
    const living = scene?.living() ?? 0;
    const when = at < 0.5 ? 'Today' : `${String(Math.round(at))} million years ago`;
    const genera = living === 1 ? '1 genus' : `${living.toLocaleString('en')} genera`;
    moment.textContent = `${when} · ${genera} living`;
  }

  function prepare(group: LineageGroup): Promise<Loaded> {
    let loading = groups.get(group);
    if (loading === undefined) {
      loading = load(group).then((lineages) => {
        const starts = origins(lineages);
        const { heads, colour } = colourGroups(lineages, PALETTE.length);
        const genera = lineages.nodes.filter(isGenus).map((node) => node.index);
        let youngest = Infinity;
        for (const index of genera)
          youngest = Math.min(youngest, elementAt(lineages.nodes, index).last);
        return {
          lineages,
          starts,
          strokes: strokes(lineages, starts),
          colour,
          heads,
          genera,
          oldest: elementAt(lineages.nodes, 0).first,
          youngest: Number.isFinite(youngest) ? youngest : 0,
          byPbdb: new Map(lineages.nodes.map((node) => [node.pbdb, node.index] as const)),
        };
      });
      loading.catch(() => groups.delete(group));
      groups.set(group, loading);
    }
    return loading;
  }

  /** The view, made once; each group's lines are drawn into it when shown. */
  function build(p: Phoria) {
    const view = new p.View({
      canvas,
      orbit: { minDistance: 3, maxDistance: 40 },
      framing: 'both',
      tooltip: (hit) => tooltipFor(hit.datum),
    });
    view3d.append(canvas);
    const [width, height, depth] = BOX;
    // The floor: the world at the playhead, drawn into a canvas from the elevation map.
    const paper = document.createElement('canvas');
    paper.width = 720;
    paper.height = 360;
    const texture = new p.Texture({ image: paper, wrap: 'clamp' });
    const floor = new p.Mesh({
      geometry: p.plane({ width, depth }),
      material: { map: texture, unlit: true, doubleSided: true },
      pickable: false,
    });
    // The box's edges, so time reads as height.
    const edges: number[] = [];
    for (const [x, z] of [
      [-width / 2, -depth / 2],
      [width / 2, -depth / 2],
      [-width / 2, depth / 2],
      [width / 2, depth / 2],
    ] as const) {
      edges.push(x, 0, z, x, height, z);
    }
    // And the bottom and top rims, so the view frames the whole box.
    for (const y of [0, height]) {
      edges.push(-width / 2, y, -depth / 2, width / 2, y, -depth / 2);
      edges.push(width / 2, y, -depth / 2, width / 2, y, depth / 2);
      edges.push(width / 2, y, depth / 2, -width / 2, y, depth / 2);
      edges.push(-width / 2, y, depth / 2, -width / 2, y, -depth / 2);
    }
    const frameLines = lines(p, edges, null, '#2a3a5c', 1, 0.8);
    const genusLines = lines(p, [], [], '#ffffff', 1.4, 0.9);
    const branchLines = lines(p, [], [], '#ffffff', 1, 0.16);
    const pickedLines = lines(p, [], null, '#ffffff', 3.5, 1);
    const ticks = new p.Group({ name: 'ticks' });
    const pin = new p.Label({
      text: '',
      position: [0, 0, 0],
      className: 'tree-label-focus',
      place: 'above',
      priority: 10,
      overlap: 'show',
      visible: false,
    });
    view.scene.add(floor, frameLines, genusLines, branchLines, pickedLines, ticks, pin);
    let dots: InstanceType<Phoria['InstancedMesh']> | null = null;
    let data: Loaded | null = null;
    let picked = -1;
    let builtAt = Number.NaN;
    let floorStep = -1;
    let alive = 0;
    const maps = new Map<number, Promise<HTMLCanvasElement>>();

    const yOf = (ma: number): number =>
      data === null || data.oldest === data.youngest
        ? 0
        : (height * (data.oldest - ma)) / (data.oldest - data.youngest);
    const xyz = (place: Place, ma: number): Xyz => [
      (place.longitude / 180) * (width / 2),
      yOf(ma),
      (-place.latitude / 90) * (depth / 2),
    ];

    function mapFor(step: number): Promise<HTMLCanvasElement> {
      let made = maps.get(step);
      if (made === undefined) {
        made = paint(floorUrl(step), paper.width, paper.height);
        made.catch(() => maps.delete(step));
        maps.set(step, made);
      }
      return made;
    }

    function drawFloor(ma: number): void {
      const step = Math.min(MAP_REACH_MA, Math.max(0, Math.round(ma / MAP_STEP_MA) * MAP_STEP_MA));
      if (step === floorStep) return;
      floorStep = step;
      mapFor(step).then(
        (painted) => {
          if (floorStep !== step) return;
          paper.getContext('2d')?.drawImage(painted, 0, 0);
          texture.needsUpdate();
        },
        () => {
          // The floor stays as it was; the lines still read without it.
        },
      );
    }

    /** Redraw what had happened by `ma`: lines below the floor, the living as dots on it. */
    function draw(ma: number): void {
      if (data === null) return;
      floor.position.set(0, yOf(ma), 0);
      drawFloor(ma);
      if (Math.abs(ma - builtAt) < 0.05) return;
      builtAt = ma;
      const own: number[] = [];
      const ownColours: number[] = [];
      const branch: number[] = [];
      const branchColours: number[] = [];
      const lit: number[] = [];
      for (const stroke of data.strokes) {
        const cut = strokeUntil(stroke.vertices, ma);
        if (cut.length < 2) continue;
        const within =
          picked < 0 || isWithin(data.lineages, stroke.node, picked) || isAncestor(stroke.node);
        const rgb = rgbOf(valueAt(data.colour, stroke.node), picked >= 0 && !within);
        const target = stroke.branch ? branch : own;
        const colours = stroke.branch ? branchColours : ownColours;
        for (let index = 1; index < cut.length; index++) {
          const a = xyz(elementAt(cut, index - 1), elementAt(cut, index - 1).ma);
          const b = xyz(elementAt(cut, index), elementAt(cut, index).ma);
          // Across the antimeridian a line would cross the whole map: leave that piece out.
          if (Math.abs(a[0] - b[0]) > width / 2) continue;
          target.push(...a, ...b);
          colours.push(...rgb, ...rgb);
          if (picked >= 0 && within) lit.push(...a, ...b);
        }
      }
      genusLines.geometry = new p.Geometry({ positions: own, colors: ownColours });
      branchLines.geometry = new p.Geometry({ positions: branch, colors: branchColours });
      pickedLines.geometry = new p.Geometry({ positions: lit });
      pickedLines.visible = lit.length > 0;

      alive = 0;
      const shown = data;
      const living = dots;
      if (living !== null) {
        shown.genera.forEach((index, slot) => {
          const node = elementAt(shown.lineages.nodes, index);
          if (!aliveAt(node, ma)) {
            living.setInstance(slot, { position: [0, -1000, 0], scale: 0 });
            return;
          }
          alive += 1;
          const dimmed = picked >= 0 && !isWithin(shown.lineages, index, picked);
          living.setInstance(slot, {
            position: [...xyz(trackAt(node.track, ma), ma)],
            scale: index === picked ? 0.09 : 0.045,
            color: dimmed ? '#3a4560' : (PALETTE[valueAt(shown.colour, index)] ?? OTHERS),
          });
        });
      }
      placePin(ma);
    }

    function isAncestor(node: number): boolean {
      return data !== null && picked >= 0 && isWithin(data.lineages, picked, node);
    }

    function placePin(ma: number): void {
      if (data === null || picked < 0) {
        pin.visible = false;
        return;
      }
      const node = elementAt(data.lineages.nodes, picked);
      const start = elementAt(data.starts, picked);
      const when = Math.max(Math.min(ma, node.first), node.last);
      const place = isGenus(node) && ma <= node.first ? trackAt(node.track, when) : start;
      pin.text = node.name;
      pin.position.set(...xyz(place, ma <= node.first ? when : start.ma));
      pin.visible = ma <= start.ma;
    }

    function setData(next: Loaded): void {
      data = next;
      builtAt = Number.NaN;
      floorStep = -1;
      if (dots !== null) view.scene.remove(dots);
      const rows = next.genera.map((index) => {
        const node = elementAt(next.lineages.nodes, index);
        return {
          pbdb: node.pbdb,
          name: node.name,
          span: span(node.first, node.last),
          species: node.species,
          family: familyOf(next.lineages, index),
        };
      });
      dots = new p.InstancedMesh({
        geometry: p.sphere({ radius: 1, segments: 10, rings: 6 }),
        material: { unlit: true },
        data: rows,
      });
      view.scene.add(dots);
      ticks.remove(...ticks.children);
      for (const ma of tickMoments(next.oldest, next.youngest)) {
        ticks.add(
          new p.Label({
            text: ma < 0.5 ? 'Today' : `${String(ma)} Ma`,
            position: [-width / 2, yOf(ma), depth / 2],
            className: 'lineages-tick',
            place: 'left',
            overlap: 'hide',
          }),
        );
      }
      canvas.dataset['genera'] = String(next.genera.length);
      canvas.dataset['group'] = next.lineages.id;
      view.frame(frameLines, { padding: 0.05, direction: [0.35, 0.45, 1] });
    }

    view.on('click', (hit) => {
      const pbdb = pbdbOf(hit?.datum);
      if (pbdb !== undefined && data !== null) onRequest({ group: data.lineages.id, pick: pbdb });
    });
    view.start((dt) => {
      if (!playing || current === null) return;
      const next = playhead() - ((current.oldest - current.youngest) / PLAY_SECONDS) * dt;
      if (next <= current.youngest) playing = false;
      setMoment(next);
    });

    return {
      view,
      setData,
      pick(index: number) {
        picked = index;
        builtAt = Number.NaN;
      },
      moment(ma: number) {
        draw(ma);
        canvas.dataset['ma'] = ma.toFixed(1);
      },
      living: () => alive,
    };
  }

  /** The playhead, read inside the view's frame callback. */
  function playhead(): number {
    return at;
  }

  function describe(data: Loaded, index: number | undefined): void {
    if (index === undefined) {
      focus.replaceChildren(
        element(
          'p',
          { class: 'stage-note' },
          `${data.lineages.name}: ${data.genera.length.toLocaleString('en')} genera, ${span(data.oldest, data.youngest)}. Pick a dot to follow its genus.`,
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
      : `${capital(node.rank === 'clade' ? 'group' : node.rank)} of ${String(generaWithin(data, index))} genera here`;
    focus.replaceChildren(
      element('h3', {}, node.name),
      element('p', { class: 'stage-note' }, `${kind}. ${capital(span(node.first, node.last))}.`),
      crumbs,
      element('div', { class: 'why-actions' }, globe, more),
    );
  }

  function render(): void {
    if (wanted === null || phoria === null) return;
    const view = wanted;
    void prepare(view.group).then(
      (data) => {
        if (wanted !== view || phoria === null) return;
        status.hidden = true;
        scene ??= build(phoria);
        if (current !== data) {
          current = data;
          scene.setData(data);
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
        scene.pick(index ?? -1);
        if (index !== undefined && index !== lastPick && !playing) {
          // A newly picked name's line shows whole: the playhead at its last appearance.
          at = elementAt(data.lineages.nodes, index).last;
        }
        lastPick = index;
        setMoment(at);
        describe(data, index);
        scene.view.start();
      },
      (error: unknown) => {
        shown = '';
        status.hidden = false;
        status.textContent = `Could not draw the lines: ${errorMessage(error)}`;
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
      scene?.view.stop();
      return;
    }
    wanted = view;
    for (const [group, button] of groupButtons) {
      button.setAttribute('aria-pressed', String(group === view.group));
    }
    if (!dialog.open) dialog.show();
    if (phoria !== null) {
      render();
      return;
    }
    status.hidden = false;
    starting ??= import('phoria2');
    starting.then(
      (loaded) => {
        phoria = loaded;
        render();
      },
      (error: unknown) => {
        starting = null;
        shown = '';
        status.textContent = `Could not draw the lines: ${errorMessage(error)}`;
      },
    );
  }

  return { dialog, show };
}

function lines(
  p: Phoria,
  positions: readonly number[],
  colors: readonly number[] | null,
  color: string,
  width: number,
  opacity: number,
): InstanceType<Phoria['Lines']> {
  return new p.Lines({
    geometry: new p.Geometry(
      colors === null
        ? { positions: [...positions] }
        : { positions: [...positions], colors: [...colors] },
    ),
    material: { color, width, unlit: true, opacity, vertexColors: colors !== null },
    pickable: false,
  });
}

/** A colour group's colour as rgb 0–1, or a dim grey for lines outside the picked one. */
function rgbOf(colour: number, dimmed: boolean): readonly [number, number, number] {
  if (dimmed) return [0.2, 0.24, 0.32];
  const hex = PALETTE[colour] ?? OTHERS;
  return [
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255,
  ];
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

/** Round moments for the time ticks, five or so across the group's span. */
function tickMoments(oldest: number, youngest: number): number[] {
  const spanMa = oldest - youngest;
  const step = [10, 20, 25, 50, 100].find((each) => spanMa / each <= 6) ?? 100;
  const out: number[] = [];
  for (let ma = Math.ceil(youngest / step) * step; ma <= oldest; ma += step) out.push(ma);
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

/** The nearest family above a genus, or its parent's name if none is a family. */
function familyOf(lineages: Lineages, index: number): string {
  const line = ancestry(lineages, index);
  const family = [...line].reverse().find((node) => node.rank === 'family');
  return family?.name ?? line.at(-2)?.name ?? '';
}

function generaWithin(data: Loaded, index: number): number {
  return data.genera.filter((genus) => isWithin(data.lineages, genus, index)).length;
}

function tooltipFor(datum: unknown): Phoria2.TooltipContent {
  if (typeof datum !== 'object' || datum === null || !('name' in datum)) return '';
  const row = datum as { name: string; span: string; species: number; family: string };
  return {
    title: row.name,
    rows: { Lived: capital(row.span), Family: row.family || '—', Species: String(row.species) },
  };
}

function pbdbOf(datum: unknown): number | undefined {
  return typeof datum === 'object' &&
    datum !== null &&
    'pbdb' in datum &&
    typeof datum.pbdb === 'number'
    ? datum.pbdb
    : undefined;
}
