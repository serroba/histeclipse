/**
 * The impacts' paths through time (#304, #322). By default a flat world map, today's coasts seen
 * from above, with each crater's track drawn like a ship's route from where it struck to where it
 * lies today. Picking a crater makes its track bold and sends a dot along it, strike to today,
 * with the date it has reached. Behind a switch, the same tracks in a 3D box with time as depth,
 * today on top, and a plane at the slider's moment. phoria2 draws both, loaded only when the
 * sheet first opens; each view is built the first time it is shown. DOM and WebGL glue, covered
 * by the Playwright suite; what is drawn is worked out in `impactPathsModel.ts` (#607), the paths
 * in `data/impactPaths.ts`, the dot's places from `placeThen`, as the globe draws them.
 */

import type * as Phoria2 from 'phoria2';
import type * as Phoria2Charts from 'phoria2/charts';

import { CONTINENT_LABELS, impactPaths, pathsReach, type ImpactPath } from '../data/impactPaths';
import { placeThen, type Impacts } from '../data/impacts';
import type { CratersShape, CratersView } from '../state/viewState';
import { errorMessage } from '../util/errors';
import type { Ring } from '../util/polygons';
import { element } from './dom';
import {
  BOX,
  boxTicks,
  coastSegments,
  craterSummary,
  graticule,
  GREY,
  HOW_TO_READ,
  idOf,
  journeyFrame,
  journeyStep,
  LOOSE,
  MAP,
  mapOpacities,
  mapPoint,
  ORANGE,
  type Place,
  reachedText,
  runSegments,
  shownKey,
  strikeRows,
  type StrikeRow,
  TIGHT,
  tooltipFor,
  tracks,
  type Xyz,
} from './impactPathsModel';
import './stageSheet.css';

export interface ImpactPathsSheet {
  readonly dialog: HTMLDialogElement;
  /**
   * Open at all the paths or one crater's, drawn on the map or in the box, at the slider's moment
   * (Ma; 0 in the years); or close.
   */
  show(view: CratersView | null, ma: number, shape: CratersShape): void;
}

type Phoria = typeof Phoria2;
type Charts = typeof Phoria2Charts;
type Coasts = readonly (readonly Ring[])[];
type Chart = ReturnType<Charts['chart']>;

interface Loaded {
  readonly impacts: Impacts;
  readonly coasts: Coasts;
  readonly paths: readonly ImpactPath[];
  readonly byId: ReadonlyMap<number, ImpactPath>;
  readonly reach: number;
  readonly phoria: Phoria;
  readonly charts: Charts;
}

/** A view of the paths: built once, then told what to pick out and when. */
interface Scene {
  /** The view's canvas in its own box, which also holds its labels: hidden as one. */
  readonly root: HTMLElement;
  readonly view: InstanceType<Phoria['View']>;
  focus(path: ImpactPath | undefined): void;
  moment(ma: number): void;
}

/** A crater tapped in either view: open at it. */
type Pick = (view: CratersView) => void;

export function createImpactPathsSheet(
  /** Asked to open at all the paths or one crater's, or to close: the view decides. */
  onRequest: (view: CratersView | null) => void,
  /** Asked to draw the paths on the map or in the box. */
  onShape: (shape: CratersShape) => void,
  /** The impacts and today's country outlines, loaded the first time they are needed. */
  load: () => Promise<{ readonly impacts: Impacts; readonly coasts: Coasts }>,
  /** Go to deep time at a crater's strike, facing where it lay then, to see it on the globe. */
  onGlobe: (ma: number, where: Place) => void,
  /** The book that says where the impacts come from. */
  why: HTMLElement,
): ImpactPathsSheet {
  const page = sheetElements(why, onRequest, onShape);
  let loaded: Loaded | null = null;
  let loading: Promise<Loaded> | null = null;
  const scenes = new Map<CratersShape, Scene>();
  let wanted: { view: CratersView; shape: CratersShape; ma: number } | null = null;
  let shown = '';

  /** Draw what is wanted, building its view the first time. */
  function render(): void {
    if (wanted === null || loaded === null) return;
    const { view, shape, ma } = wanted;
    let scene = scenes.get(shape);
    if (scene === undefined) {
      scene = shape === 'map' ? drawMap(loaded, onRequest) : drawBox(loaded, page.frame, onRequest);
      scenes.set(shape, scene);
      page.frame.prepend(scene.root);
    }
    for (const [each, other] of scenes) {
      const on = each === shape;
      other.root.hidden = !on;
      if (on) other.view.start();
      else other.view.stop();
    }
    const path = view === 'all' ? undefined : loaded.byId.get(view.id);
    scene.focus(path);
    scene.moment(ma);
    page.focus.replaceChildren(...described(view, path, onGlobe));
  }

  function show(view: CratersView | null, ma: number, shape: CratersShape): void {
    const key = shownKey(view, shape, ma);
    if (key === shown) return;
    shown = key;
    for (const [each, button] of page.shapeButtons) {
      button.setAttribute('aria-pressed', String(each === shape));
    }
    page.howToRead.textContent = HOW_TO_READ[shape];
    const { dialog, status } = page;
    if (view === null) {
      wanted = null;
      if (dialog.open) dialog.close();
      for (const scene of scenes.values()) scene.view.stop();
      return;
    }
    wanted = { view, shape, ma };
    if (!dialog.open) dialog.show();
    if (loaded !== null) {
      render();
      return;
    }
    loading ??= loadAll(load);
    loading.then(
      (data) => {
        loaded = data;
        status.hidden = true;
        render();
      },
      (error: unknown) => {
        loading = null;
        shown = '';
        status.hidden = false;
        status.textContent = `Could not draw the paths: ${errorMessage(error)}`;
      },
    );
  }

  return { dialog: page.dialog, show };
}

/** The impacts, the coasts and phoria, with each crater's path worked out. */
async function loadAll(
  load: () => Promise<{ readonly impacts: Impacts; readonly coasts: Coasts }>,
): Promise<Loaded> {
  const [data, phoria, charts] = await Promise.all([
    load(),
    import('phoria2'),
    import('phoria2/charts'),
  ]);
  const paths = impactPaths(data.impacts);
  return {
    ...data,
    paths,
    byId: new Map(paths.map((path) => [path.impact.id, path] as const)),
    reach: pathsReach(data.impacts),
    phoria,
    charts,
  };
}

/** The sheet's own elements: its header, the switch between the views, the notes. */
function sheetElements(
  why: HTMLElement,
  onRequest: (view: CratersView | null) => void,
  onShape: (shape: CratersShape) => void,
) {
  const close = element(
    'button',
    { type: 'button', class: 'famous-close', 'aria-label': 'Close' },
    '×',
  );
  const shapeButtons = new Map<CratersShape, HTMLButtonElement>(
    (['map', 'box'] as const).map((shape) => {
      const button = element(
        'button',
        { type: 'button', class: 'stage-switch-option', 'aria-pressed': 'false' },
        shape === 'map' ? 'Map' : '3D',
      );
      button.addEventListener('click', () => {
        onShape(shape);
      });
      return [shape, button] as const;
    }),
  );
  const switcher = element(
    'div',
    { class: 'stage-switch', role: 'group', 'aria-label': 'Draw the paths' },
    ...shapeButtons.values(),
  );
  const howToRead = element('p', { class: 'stage-how', 'data-testid': 'craters-how' });
  const status = element('p', { class: 'stage-status', role: 'status' }, 'Loading the paths…');
  const legend = element(
    'div',
    { class: 'stage-legend stage-key' },
    element('span', { class: 'stage-key-swatch is-tight' }),
    TIGHT,
    element('span', { class: 'stage-key-swatch is-loose' }),
    LOOSE,
  );
  // Each view's canvas joins the page the first time that view is drawn.
  const frame = element('div', { class: 'stage-frame' }, legend);
  const focus = element('div', { class: 'stage-focus', 'data-testid': 'craters-focus' });
  const all = element('button', { type: 'button', class: 'why-all' }, 'All the craters');
  const dialog = element(
    'dialog',
    { class: 'famous-dialog stage-sheet', 'aria-labelledby': 'craters-title' },
    element(
      'header',
      { class: 'famous-header' },
      element('h2', { id: 'craters-title' }, 'Impacts through time ', why),
      close,
    ),
    element(
      'div',
      { class: 'stage-body' },
      element('div', { class: 'stage-bar' }, switcher, howToRead),
      frame,
      status,
      focus,
      element(
        'p',
        { class: 'stage-note' },
        'Places from the PALEOMAP reconstruction, which reaches 540 million years back: older craters start there. Only craters found are here: erosion and the sinking of old sea floor have erased most that struck.',
      ),
      element('div', { class: 'why-actions' }, all),
    ),
  );
  close.addEventListener('click', () => {
    onRequest(null);
  });
  all.addEventListener('click', () => {
    onRequest('all');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dialog.open) onRequest(null);
  });
  return { dialog, shapeButtons, howToRead, status, frame, focus };
}

/** What is said under the view: the crater picked and the way to it on the globe. */
function described(
  view: CratersView,
  path: ImpactPath | undefined,
  onGlobe: (ma: number, where: Place) => void,
): HTMLElement[] {
  if (path === undefined) {
    return view === 'all'
      ? []
      : [element('p', {}, 'No path is drawn for that crater; here are all of them.')];
  }
  const first = path.runs[0]?.[0];
  const globe = element(
    'button',
    { type: 'button', class: 'why-all' },
    `See it on the globe, ${String(Math.round(path.fromMa))} million years ago`,
  );
  globe.addEventListener('click', () => {
    if (first !== undefined) onGlobe(path.fromMa, first);
  });
  return [
    element('h3', {}, path.impact.name),
    element('p', { class: 'stage-note' }, craterSummary(path)),
    globe,
  ];
}

/** The flat map: coasts, every track, a dot where each struck; the picked one followed. */
function drawMap(data: Loaded, onPick: Pick): Scene {
  const { phoria } = data;
  const canvas = element('canvas', {
    class: 'stage-canvas',
    'data-testid': 'craters-map',
    'aria-label': 'Impact craters’ journeys on a world map: drag to move, scroll to zoom',
  });
  const root = element('div', { class: 'stage-view' }, canvas);
  const view = new phoria.View({
    canvas,
    camera: 'top',
    orbit: { mode: 'map', minDistance: 0.6, maxDistance: 8 },
    framing: 'both',
    tooltip: (hit) => tooltipFor(hit.datum),
  });
  const world = mapWorld(data, view);
  const journey = mapJourney(data, view);
  view.on('click', (hit) => {
    const id = idOf(hit?.datum);
    if (id !== undefined) onPick({ id });
  });
  view.frame(world.ocean);
  canvas.dataset['craters'] = String(world.strikes);

  return {
    root,
    view,
    focus(path) {
      const opacity = mapOpacities(path !== undefined);
      world.tight.material.opacity = opacity.tight;
      world.loose.material.opacity = opacity.loose;
      world.dots.material.opacity = opacity.dots;
      journey.follow(path);
      if (path === undefined) view.frame(world.ocean, { duration: 0.6 });
    },
    moment() {
      // The map follows a crater's journey, not the slider.
    },
  };
}

/** The map's world: the ocean, the graticule, the coasts and continents, every track and dot. */
function mapWorld(data: Loaded, view: InstanceType<Phoria['View']>) {
  const { phoria } = data;
  const world = new phoria.Group({ name: 'world' });
  const ocean = new phoria.Mesh({
    geometry: phoria.plane({ width: MAP[0], depth: MAP[1] }),
    material: { color: '#0b1830', unlit: true },
    position: [0, -0.02, 0],
    pickable: false,
  });
  world.add(
    ocean,
    lines(phoria, graticule(), '#1c2c48', 1, 1),
    lines(
      phoria,
      coastSegments(data.coasts, (place) => mapPoint(place)),
      '#4f74a8',
      1,
      0.9,
    ),
    ...continents(phoria, (place) => mapPoint(place, 0.05)),
  );
  const at = (place: Place): Xyz => mapPoint(place, 0.01);
  const tight = lines(phoria, tracks(data.paths, true, at), ORANGE, 1.5, 0.75);
  const loose = lines(phoria, tracks(data.paths, false, at), GREY, 1, 0.35);
  const strikes = strikeRows(data.paths);
  const dots = new phoria.InstancedMesh({
    geometry: phoria.sphere({ radius: 1, segments: 12, rings: 8 }),
    material: { unlit: true },
    data: strikes,
    instances: strikes.map((row) => ({
      position: [...mapPoint(row, 0.02)],
      scale: 0.025 + 0.03 * row.size,
      color: row.tight ? ORANGE : GREY,
    })),
  });
  world.add(tight, loose, dots);
  view.scene.add(world);
  return { ocean, tight, loose, dots, strikes: strikes.length };
}

/** The picked crater on the map: its track bold, a dot travelling it, and the date reached. */
function mapJourney(data: Loaded, view: InstanceType<Phoria['View']>) {
  const { phoria } = data;
  const traveller = new phoria.Mesh({
    geometry: phoria.sphere({ radius: 0.06, segments: 16, rings: 12 }),
    material: { color: '#ffffff', unlit: true },
    visible: false,
    pickable: false,
  });
  const reached = new phoria.Label({
    text: '',
    position: [0, 0, 0],
    className: 'tree-label-focus',
    place: 'above',
    priority: 10,
    overlap: 'show',
    visible: false,
  });
  view.scene.add(traveller, reached);
  let picked: InstanceType<Phoria['Group']> | null = null;
  let journey: { path: ImpactPath; t: number } | null = null;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function place(path: ImpactPath, ma: number): void {
    const where = placeThen(data.impacts, path.impact, ma);
    if (where === null) return;
    const spot = mapPoint(where, 0.06);
    traveller.position.set(spot[0], spot[1], spot[2]);
    reached.position.set(spot[0], spot[1], spot[2]);
    const text = reachedText(ma);
    if (reached.text !== text) reached.text = text;
  }
  view.start((dt) => {
    if (journey === null) return;
    const step = journeyStep(journey.path, journey.t, dt);
    journey.t = step.t;
    place(journey.path, step.ma);
  });

  return {
    follow(path: ImpactPath | undefined): void {
      if (picked !== null) view.scene.remove(picked);
      picked = null;
      journey = null;
      traveller.visible = path !== undefined;
      reached.visible = path !== undefined;
      if (path === undefined) return;
      const group = new phoria.Group({ name: 'journey' });
      const segments = path.runs.flatMap((run) => runSegments(run, (p) => mapPoint(p, 0.03)));
      group.add(lines(phoria, segments, '#ffffff', 4, 1));
      const first = path.runs[0]?.[0];
      if (first !== undefined) {
        group.add(
          new phoria.Label({
            text: `${path.impact.name}: struck here`,
            position: [...mapPoint(first, 0.05)],
            className: 'stage-pin',
            place: 'below',
            priority: 9,
            overlap: 'show',
          }),
        );
      }
      // The camera takes in the journey with room around it: an all but invisible patch.
      const frame = journeyFrame(path);
      group.add(
        new phoria.Mesh({
          geometry: phoria.plane({ width: frame.width, depth: frame.depth }),
          material: { color: '#0b1830', opacity: 0.01, unlit: true },
          position: [...mapPoint(frame.centre, -0.03)],
          pickable: false,
        }),
      );
      view.scene.add(group);
      picked = group;
      if (still) place(path, 0);
      else journey = { path, t: 0 };
      view.frame(group, { padding: 0.3, duration: 0.6 });
    },
  };
}

/** The 3D box: longitude, latitude and time, today on top, a plane at the slider's moment. */
function drawBox(data: Loaded, frame: HTMLElement, onPick: Pick): Scene {
  const { phoria } = data;
  const canvas = element('canvas', {
    class: 'stage-canvas',
    'data-testid': 'craters-box',
    'aria-label':
      'Impact craters in 3D: longitude across, latitude in depth, time downward. Drag to turn it, scroll to zoom',
  });
  const root = element('div', { class: 'stage-view' }, canvas);
  const view = new phoria.View({
    canvas,
    orbit: { minDistance: 3, maxDistance: 60 },
    framing: 'both',
  });
  const strikes = strikeRows(data.paths);
  const chart = view.scene.add(
    boxChart(data, strikes, (frame.clientWidth || window.innerWidth) < 520),
  );
  const { x, y, z } = chart.scales;
  const at = (place: Place, ma: number): Xyz => [
    x === undefined ? 0 : x(place.longitude),
    y === undefined ? 0 : y(-ma),
    z === undefined ? 0 : z(place.latitude),
  ];
  chart.add(
    lines(
      phoria,
      coastSegments(data.coasts, (place) => at(place, 0)),
      '#4a6a9a',
      1,
      0.7,
    ),
    lines(
      phoria,
      tracks(data.paths, true, (p) => at(p, p.ma)),
      ORANGE,
      1.5,
      0.8,
    ),
    lines(
      phoria,
      tracks(data.paths, false, (p) => at(p, p.ma)),
      GREY,
      1,
      0.35,
    ),
    ...continents(phoria, (place) => at(place, 0)),
  );
  const playhead = chart.add(
    new phoria.Mesh({
      geometry: phoria.plane({ width: BOX[0], depth: BOX[2] }),
      material: { color: '#9bc4ff', opacity: 0.12, unlit: true, doubleSided: true },
      pickable: false,
    }),
  );
  view.on('click', (hit) => {
    const id = idOf(hit?.datum);
    if (id !== undefined) onPick({ id });
  });
  view.frame(chart);
  canvas.dataset['craters'] = String(strikes.length);
  const crater = boxCrater(phoria, chart, at);

  return {
    root,
    view,
    focus(path) {
      crater.focus(path);
    },
    moment(ma) {
      const clamped = Math.min(Math.max(ma, 0), data.reach);
      playhead.position.set(0, y === undefined ? 0 : y(-clamped), 0);
    },
  };
}

/** The box's chart: a dot where and when each crater struck, on longitude, latitude and time. */
function boxChart(data: Loaded, strikes: readonly StrikeRow[], narrow: boolean): Chart {
  const ticks = boxTicks(narrow);
  return data.charts.chart({
    mark: 'point',
    theme: 'dark',
    box: BOX,
    data: strikes,
    x: {
      field: 'longitude',
      title: 'Longitude',
      scale: { domain: [-180, 180], nice: false },
      axis: { ticks: ticks.longitude },
    },
    z: {
      field: 'latitude',
      title: 'Latitude',
      scale: { domain: [-90, 90], nice: false },
      axis: { ticks: ticks.latitude },
    },
    y: {
      field: 'time',
      title: 'Ma ago',
      scale: { domain: [-data.reach, 0], nice: false },
      axis: { ticks: ticks.time, format: (value: number) => String(Math.round(-value)) },
    },
    color: {
      field: 'dating',
      title: 'Dating',
      scale: { domain: [TIGHT, LOOSE], range: [ORANGE, GREY] },
      legend: false,
    },
    size: { field: 'size', scale: { range: [0.04, 0.22] } },
    legend: false,
    tooltip: ['name', 'age', 'width', 'travelled'],
  });
}

/** The crater picked in the box: its track bold, its name where it struck. */
function boxCrater(phoria: Phoria, chart: Chart, at: (place: Place, ma: number) => Xyz) {
  let picked: InstanceType<Phoria['Group']> | null = null;
  return {
    focus(path: ImpactPath | undefined): void {
      if (picked !== null) chart.remove(picked);
      picked = null;
      if (path === undefined) return;
      const group = new phoria.Group({ name: 'crater' });
      const segments = path.runs.flatMap((run) => runSegments(run, (p) => at(p, p.ma)));
      group.add(lines(phoria, segments, '#ffffff', 4, 1));
      const first = path.runs[0]?.[0];
      if (first !== undefined) {
        group.add(
          new phoria.Label({
            text: path.impact.name,
            position: [...at(first, first.ma)],
            className: 'tree-label-focus',
            priority: 10,
            overlap: 'show',
          }),
        );
      }
      chart.add(group);
      picked = group;
    },
  };
}

/** The continents' names, each where `at` puts it. */
function continents(phoria: Phoria, at: (place: Place) => Xyz): InstanceType<Phoria['Label']>[] {
  return CONTINENT_LABELS.map(
    (continent) =>
      new phoria.Label({
        text: continent.name,
        position: [...at(continent)],
        className: 'stage-continent',
        overlap: 'hide',
      }),
  );
}

function lines(
  phoria: Phoria,
  positions: readonly number[],
  color: string,
  width: number,
  opacity: number,
): InstanceType<Phoria['Lines']> {
  return new phoria.Lines({
    geometry: new phoria.Geometry({ positions: [...positions] }),
    material: { color, width, unlit: true, opacity },
    pickable: false,
  });
}
