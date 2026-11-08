/**
 * The impacts' paths through time (#304, #322). By default a flat world map, today's coasts seen
 * from above, with each crater's track drawn like a ship's route from where it struck to where it
 * lies today. Picking a crater makes its track bold and sends a dot along it, strike to today,
 * with the date it has reached. Behind a switch, the same tracks in a 3D box with time as depth,
 * today on top, and a plane at the slider's moment.
 *
 * phoria2 draws both, loaded only when the sheet first opens; each view is built the first time it
 * is shown. DOM and WebGL glue, covered by the Playwright suite; the paths are in
 * `data/impactPaths.ts`, the dot's places from `placeThen`, as the globe draws them.
 */

import type * as Phoria2 from 'phoria2';
import type * as Phoria2Charts from 'phoria2/charts';

import {
  CONTINENT_LABELS,
  impactPaths,
  pathKm,
  pathsReach,
  type ImpactPath,
  type PathPoint,
} from '../data/impactPaths';
import { placeThen, type Impacts } from '../data/impacts';
import type { CratersShape, CratersView } from '../state/viewState';
import { errorMessage } from '../util/errors';
import type { Ring } from '../util/polygons';
import { element } from './dom';

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
type Xyz = readonly [number, number, number];
interface Place {
  readonly longitude: number;
  readonly latitude: number;
}

interface Loaded {
  readonly impacts: Impacts;
  readonly coasts: readonly (readonly Ring[])[];
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

const TIGHT = 'Dated to within 10 million years';
const LOOSE = 'Dated only loosely: drawn from the middle of its span';
const ORANGE = '#ff8a3d';
const GREY = '#8a93a8';

/** The map's size in the view's units: longitude across, latitude up the screen. */
const MAP: readonly [number, number] = [12, 6];
/** The box: longitude, time, latitude. */
const BOX: [number, number, number] = [12, 6, 6];

const HOW_TO_READ: Readonly<Record<CratersShape, string>> = {
  map: 'Today’s world from above. Each line is a crater’s journey with its plate, from where it struck (the dot) to where it lies today. Pick a crater to follow it.',
  box: 'A stack of world maps: today on top, 540 million years ago at the bottom. Each line climbs from where a crater struck to where it lies today. The plane is the moment the slider shows.',
};

export function createImpactPathsSheet(
  /** Asked to open at all the paths or one crater's, or to close: the view decides. */
  onRequest: (view: CratersView | null) => void,
  /** Asked to draw the paths on the map or in the box. */
  onShape: (shape: CratersShape) => void,
  /** The impacts and today's country outlines, loaded the first time they are needed. */
  load: () => Promise<{ readonly impacts: Impacts; readonly coasts: readonly (readonly Ring[])[] }>,
  /** Go to deep time at a crater's strike, facing where it lay then, to see it on the globe. */
  onGlobe: (ma: number, where: Place) => void,
  /** The book that says where the impacts come from. */
  why: HTMLElement,
): ImpactPathsSheet {
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
      scene = shape === 'map' ? drawMap(loaded) : drawBox(loaded);
      scenes.set(shape, scene);
      frame.prepend(scene.root);
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
    describe(view, path);
  }

  function describe(view: CratersView, path: ImpactPath | undefined): void {
    if (path === undefined) {
      focus.replaceChildren(
        ...(view === 'all'
          ? []
          : [element('p', {}, 'No path is drawn for that crater; here are all of them.')]),
      );
      return;
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
    const width =
      path.impact.diameterKm === null
        ? 'width not known'
        : `${String(path.impact.diameterKm)} km across`;
    const since = path.beyondReach
      ? ' since 540 million years ago, as far back as the reconstruction reaches'
      : ' since it struck';
    focus.replaceChildren(
      element('h3', {}, path.impact.name),
      element(
        'p',
        { class: 'stage-note' },
        `${path.impact.age} million years old, ${width}. Carried about ${Math.round(pathKm(path)).toLocaleString('en')} km by its plate${since}.`,
      ),
      globe,
    );
  }

  /** The flat map: coasts, every track, a dot where each struck; the picked one followed. */
  function drawMap(data: Loaded): Scene {
    const { phoria } = data;
    const canvas = element('canvas', {
      class: 'stage-canvas',
      'data-testid': 'craters-map',
      'aria-label': 'Impact craters’ journeys on a world map: drag to move, scroll to zoom',
    });
    const root = element('div', { class: 'stage-view' }, canvas);
    const at = (place: Place, lift = 0): Xyz => [
      (place.longitude / 180) * (MAP[0] / 2),
      lift,
      (-place.latitude / 90) * (MAP[1] / 2),
    ];
    const view = new phoria.View({
      canvas,
      camera: 'top',
      orbit: { mode: 'map', minDistance: 0.6, maxDistance: 8 },
      framing: 'both',
      tooltip: (hit) => tooltipFor(hit.datum),
    });
    const world = new phoria.Group({ name: 'world' });
    const ocean = new phoria.Mesh({
      geometry: phoria.plane({ width: MAP[0], depth: MAP[1] }),
      material: { color: '#0b1830', unlit: true },
      position: [0, -0.02, 0],
      pickable: false,
    });
    const graticule: number[] = [];
    for (let longitude = -180; longitude <= 180; longitude += 30) {
      graticule.push(
        ...at({ longitude, latitude: -90 }, -0.01),
        ...at({ longitude, latitude: 90 }, -0.01),
      );
    }
    for (let latitude = -60; latitude <= 60; latitude += 30) {
      graticule.push(
        ...at({ longitude: -180, latitude }, -0.01),
        ...at({ longitude: 180, latitude }, -0.01),
      );
    }
    world.add(
      ocean,
      lines(phoria, graticule, '#1c2c48', 1, 1),
      lines(
        phoria,
        coastSegments(data.coasts, (place) => at(place)),
        '#4f74a8',
        1,
        0.9,
      ),
      ...CONTINENT_LABELS.map(
        (continent) =>
          new phoria.Label({
            text: continent.name,
            position: [...at(continent, 0.05)],
            className: 'stage-continent',
            overlap: 'hide',
          }),
      ),
    );
    const tight = lines(
      phoria,
      tracks(data.paths, true, (p) => at(p, 0.01)),
      ORANGE,
      1.5,
      0.75,
    );
    const loose = lines(
      phoria,
      tracks(data.paths, false, (p) => at(p, 0.01)),
      GREY,
      1,
      0.35,
    );
    const strikes = strikeRows(data.paths);
    const dots = new phoria.InstancedMesh({
      geometry: phoria.sphere({ radius: 1, segments: 12, rings: 8 }),
      material: { unlit: true },
      data: strikes,
      instances: strikes.map((row) => ({
        position: [...at(row, 0.02)],
        scale: 0.025 + 0.03 * row.size,
        color: row.tight ? ORANGE : GREY,
      })),
    });
    world.add(tight, loose, dots);
    view.scene.add(world);

    // The picked crater: its track bold, a dot travelling it, and the date it has reached.
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

    view.start((dt) => {
      if (journey === null) return;
      const { path } = journey;
      // A few seconds from strike to today, longer for older craters, then a pause, and again.
      const travel = Math.min(8, Math.max(3, path.fromMa / 40));
      journey.t = (journey.t + dt) % (travel + 1.5);
      place(path, Math.max(0, path.fromMa * (1 - journey.t / travel)));
    });
    function place(path: ImpactPath, ma: number): void {
      const where = placeThen(data.impacts, path.impact, ma);
      if (where === null) return;
      const spot = at(where, 0.06);
      traveller.position.set(spot[0], spot[1], spot[2]);
      reached.position.set(spot[0], spot[1], spot[2]);
      const text = ma < 0.5 ? 'Today' : `${String(Math.round(ma))} million years ago`;
      if (reached.text !== text) reached.text = text;
    }

    view.on('click', (hit) => {
      const id = idOf(hit?.datum);
      if (id !== undefined) onRequest({ id });
    });
    view.frame(ocean);
    canvas.dataset['craters'] = String(strikes.length);

    return {
      root,
      view,
      focus(path) {
        if (picked !== null) view.scene.remove(picked);
        picked = null;
        journey = null;
        traveller.visible = false;
        reached.visible = false;
        tight.material.opacity = path === undefined ? 0.75 : 0.12;
        loose.material.opacity = path === undefined ? 0.35 : 0.1;
        dots.material.opacity = path === undefined ? 1 : 0.35;
        if (path === undefined) {
          view.frame(ocean, { duration: 0.6 });
          return;
        }
        const segments = path.runs.flatMap((run) => runSegments(run, (p) => at(p, 0.03)));
        const first = path.runs[0]?.[0];
        const group = new phoria.Group({ name: 'journey' });
        group.add(lines(phoria, segments, '#ffffff', 4, 1));
        if (first !== undefined) {
          group.add(
            new phoria.Label({
              text: `${path.impact.name}: struck here`,
              position: [...at(first, 0.05)],
              className: 'stage-pin',
              place: 'below',
              priority: 9,
              overlap: 'show',
            }),
          );
        }
        // The camera takes in the journey with room around it: at least a sixth of the world.
        group.add(extentOf(phoria, path, at));
        view.scene.add(group);
        picked = group;
        traveller.visible = true;
        reached.visible = true;
        if (still) place(path, 0);
        else journey = { path, t: 0 };
        view.frame(group, { padding: 0.3, duration: 0.6 });
      },
      moment() {
        // The map follows a crater's journey, not the slider.
      },
    };
  }

  /** The 3D box: longitude, latitude and time, today on top, a plane at the slider's moment. */
  function drawBox(data: Loaded): Scene {
    const { phoria, charts } = data;
    const canvas = element('canvas', {
      class: 'stage-canvas',
      'data-testid': 'craters-box',
      'aria-label':
        'Impact craters in 3D: longitude across, latitude in depth, time downward. Drag to turn it, scroll to zoom',
    });
    const root = element('div', { class: 'stage-view' }, canvas);
    const narrow = (frame.clientWidth || window.innerWidth) < 520;
    const view = new phoria.View({
      canvas,
      orbit: { minDistance: 3, maxDistance: 60 },
      framing: 'both',
    });
    const strikes = strikeRows(data.paths);
    const chart = view.scene.add(
      charts.chart({
        mark: 'point',
        theme: 'dark',
        box: BOX,
        data: strikes,
        x: {
          field: 'longitude',
          title: 'Longitude',
          scale: { domain: [-180, 180], nice: false },
          axis: { ticks: narrow ? [-180, 0, 180] : [-180, -90, 0, 90, 180] },
        },
        z: {
          field: 'latitude',
          title: 'Latitude',
          scale: { domain: [-90, 90], nice: false },
          axis: { ticks: narrow ? [-90, 0, 90] : [-90, -45, 0, 45, 90] },
        },
        y: {
          field: 'time',
          title: 'Ma ago',
          scale: { domain: [-data.reach, 0], nice: false },
          axis: {
            ticks: narrow ? [-500, -250, 0] : [-500, -400, -300, -200, -100, 0],
            format: (value: number) => String(Math.round(-value)),
          },
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
      }),
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
      ...CONTINENT_LABELS.map(
        (continent) =>
          new phoria.Label({
            text: continent.name,
            position: [...at(continent, 0)],
            className: 'stage-continent',
            overlap: 'hide',
          }),
      ),
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
      if (id !== undefined) onRequest({ id });
    });
    view.frame(chart);
    canvas.dataset['craters'] = String(strikes.length);
    let picked: InstanceType<Phoria['Group']> | null = null;

    return {
      root,
      view,
      focus(path) {
        if (picked !== null) chart.remove(picked);
        picked = null;
        if (path === undefined) return;
        const group = new phoria.Group({ name: 'crater' });
        group.add(
          lines(
            phoria,
            path.runs.flatMap((run) => runSegments(run, (p) => at(p, p.ma))),
            '#ffffff',
            4,
            1,
          ),
        );
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
      moment(ma) {
        const clamped = Math.min(Math.max(ma, 0), data.reach);
        playhead.position.set(0, y === undefined ? 0 : y(-clamped), 0);
      },
    };
  }

  function show(view: CratersView | null, ma: number, shape: CratersShape): void {
    const key =
      view === null ? '' : `${view === 'all' ? 'all' : String(view.id)}:${shape}:${String(ma)}`;
    if (key === shown) return;
    shown = key;
    for (const [each, button] of shapeButtons) {
      button.setAttribute('aria-pressed', String(each === shape));
    }
    howToRead.textContent = HOW_TO_READ[shape];
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
    loading ??= Promise.all([load(), import('phoria2'), import('phoria2/charts')]).then(
      ([data, phoria, charts]) => {
        const paths = impactPaths(data.impacts);
        return {
          ...data,
          paths,
          byId: new Map(paths.map((path) => [path.impact.id, path] as const)),
          reach: pathsReach(data.impacts),
          phoria,
          charts,
        };
      },
    );
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

  return { dialog, show };
}

/** One row per crater with a path: where and when it struck, and what the tooltip says. */
function strikeRows(paths: readonly ImpactPath[]) {
  return paths.flatMap((path) => {
    const first = path.runs[0]?.[0];
    if (first === undefined) return [];
    return [
      {
        id: path.impact.id,
        name: path.impact.name,
        longitude: first.longitude,
        latitude: first.latitude,
        time: -first.ma,
        tight: path.tight,
        dating: path.tight ? TIGHT : LOOSE,
        age: `${path.impact.age} Ma`,
        width:
          path.impact.diameterKm === null ? 'not known' : `${String(path.impact.diameterKm)} km`,
        travelled: `${Math.round(pathKm(path)).toLocaleString('en')} km`,
        size: Math.log10(1 + (path.impact.diameterKm ?? 1)) / Math.log10(301),
      },
    ];
  });
}

function tooltipFor(datum: unknown): Phoria2.TooltipContent {
  if (typeof datum !== 'object' || datum === null || !('name' in datum)) return '';
  const row = datum as ReturnType<typeof strikeRows>[number];
  return { title: row.name, rows: { Age: row.age, Width: row.width, Travelled: row.travelled } };
}

function idOf(datum: unknown): number | undefined {
  return typeof datum === 'object' &&
    datum !== null &&
    'id' in datum &&
    typeof datum.id === 'number'
    ? datum.id
    : undefined;
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

/** Every track of one dating, as line segments. */
function tracks(
  paths: readonly ImpactPath[],
  tight: boolean,
  at: (point: PathPoint) => Xyz,
): number[] {
  const out: number[] = [];
  for (const path of paths) {
    if (path.tight !== tight) continue;
    for (const run of path.runs) out.push(...runSegments(run, at));
  }
  return out;
}

/** A run as line segments, each point to the next. */
function runSegments(run: readonly PathPoint[], at: (point: PathPoint) => Xyz): number[] {
  const out: number[] = [];
  for (let step = 1; step < run.length; step++) {
    const a = run[step - 1];
    const b = run[step];
    if (a === undefined || b === undefined) continue;
    out.push(...at(a), ...at(b));
  }
  return out;
}

/**
 * Today's coasts as line segments. Some outlines run past 180° (Antarctica's to 540°): wrapped,
 * and broken where they cross the antimeridian.
 */
function coastSegments(coasts: readonly (readonly Ring[])[], at: (place: Place) => Xyz): number[] {
  const out: number[] = [];
  for (const country of coasts) {
    for (const ring of country) {
      for (let step = 1; step < ring.length; step++) {
        const a = ring[step - 1];
        const b = ring[step];
        if (a === undefined || b === undefined) continue;
        const from = wrap(a[0]);
        const to = wrap(b[0]);
        if (Math.abs(from - to) > 180) continue;
        out.push(
          ...at({ longitude: from, latitude: a[1] }),
          ...at({ longitude: to, latitude: b[1] }),
        );
      }
    }
  }
  return out;
}

/**
 * An all but invisible patch over a journey and around it, at least 60° by 30°, for the camera to
 * take in: a short journey is not zoomed into a blur.
 */
function extentOf(
  phoria: Phoria,
  path: ImpactPath,
  at: (place: Place, lift?: number) => Xyz,
): InstanceType<Phoria['Mesh']> {
  const points = path.runs.flat();
  const longitudes = points.map((p) => p.longitude);
  const latitudes = points.map((p) => p.latitude);
  const middle = {
    longitude: (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
    latitude: (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
  };
  const across = Math.max(60, Math.max(...longitudes) - Math.min(...longitudes));
  const up = Math.max(30, Math.max(...latitudes) - Math.min(...latitudes));
  const centre = at(middle, -0.03);
  return new phoria.Mesh({
    geometry: phoria.plane({ width: (across / 360) * MAP[0], depth: (up / 180) * MAP[1] }),
    material: { color: '#0b1830', opacity: 0.01, unlit: true },
    position: [...centre],
    pickable: false,
  });
}

/** A longitude in −180..180. */
function wrap(longitude: number): number {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}
