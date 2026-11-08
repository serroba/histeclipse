/**
 * The impacts' paths through time (#304): a sheet with a 3D box of longitude, latitude and time,
 * today on top. Each crater is a marker where and when it struck, sized by its width, and a line
 * up through the box to where it lies today: its path as its plate moved. A plane marks the
 * moment the slider shows. Picking a crater lights its path and says how far it travelled.
 *
 * phoria2 draws it, loaded only when the sheet first opens. DOM and WebGL glue, covered by the
 * Playwright suite; the paths are in `data/impactPaths.ts`.
 */

import type * as Phoria2 from 'phoria2';
import type * as Phoria2Charts from 'phoria2/charts';

import {
  impactPaths,
  pathKm,
  pathsReach,
  type ImpactPath,
  type PathPoint,
} from '../data/impactPaths';
import { impactDetails, type Impacts } from '../data/impacts';
import type { Ring } from '../util/polygons';
import type { CratersView } from '../state/viewState';
import { errorMessage } from '../util/errors';
import { element } from './dom';

export interface ImpactPathsSheet {
  readonly dialog: HTMLDialogElement;
  /** Open at all the paths or one crater's, at the slider's moment (Ma; 0 in the years); or close. */
  show(view: CratersView | null, ma: number): void;
}

type Phoria = typeof Phoria2;
type Charts = typeof Phoria2Charts;

interface Drawn {
  readonly view: InstanceType<Phoria['View']>;
  readonly chart: ReturnType<Charts['chart']>;
  readonly phoria: Phoria;
  readonly playhead: InstanceType<Phoria['Mesh']>;
  readonly paths: ReadonlyMap<number, ImpactPath>;
  focus: InstanceType<Phoria['Group']> | null;
}

/** The box, in the view's units: longitude, time, latitude. */
const BOX: [number, number, number] = [12, 6, 6];
const TIGHT = 'Dated to within 10 million years';
const LOOSE = 'Dated only loosely: drawn from the middle of its span';

export function createImpactPathsSheet(
  /** Asked to open at all the paths or one crater's, or to close: the view decides. */
  onRequest: (view: CratersView | null) => void,
  /** The impacts and today's country outlines, loaded the first time they are needed. */
  load: () => Promise<{ readonly impacts: Impacts; readonly coasts: readonly (readonly Ring[])[] }>,
  /** Go to deep time at a crater's strike, facing where it lay then, to see it on the globe. */
  onGlobe: (ma: number, where: { latitude: number; longitude: number }) => void,
  /** The book that says where the impacts come from. */
  why: HTMLElement,
): ImpactPathsSheet {
  const close = element(
    'button',
    { type: 'button', class: 'famous-close', 'aria-label': 'Close' },
    '×',
  );
  const status = element('p', { class: 'stage-status', role: 'status' }, 'Loading the paths…');
  const canvas = element('canvas', {
    class: 'stage-canvas',
    'data-testid': 'craters-canvas',
    'aria-label':
      'Impact craters in 3D: longitude across, latitude in depth, time downward. Drag to turn it, scroll to zoom',
  });
  const legend = element('div', { class: 'stage-legend' });
  // The canvas joins the page only when the paths are first drawn.
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
      frame,
      status,
      focus,
      element(
        'p',
        { class: 'stage-note' },
        'Each line climbs from where a crater struck to where it lies today, as its plate carried it on the PALEOMAP reconstruction, which reaches 540 million years back: older craters start there. The plane is the moment the slider shows. Only craters found are here: erosion and the sinking of old sea floor have erased most that struck.',
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

  let drawn: Drawn | null = null;
  let starting: Promise<void> | null = null;
  let wanted: CratersView | null = null;
  let wantedMa = 0;
  let shownKey = '';

  async function start(): Promise<void> {
    const [loaded, phoria, charts] = await Promise.all([
      load(),
      import('phoria2'),
      import('phoria2/charts'),
    ]);
    frame.prepend(canvas);
    drawn = draw(loaded.impacts, loaded.coasts, phoria, charts);
    status.textContent = '';
    status.hidden = true;
  }

  function draw(
    impacts: Impacts,
    coasts: readonly (readonly Ring[])[],
    phoria: Phoria,
    charts: Charts,
  ): Drawn {
    const reach = pathsReach(impacts);
    const paths = impactPaths(impacts);
    const view = new phoria.View({
      canvas,
      orbit: { minDistance: 3, maxDistance: 60 },
      framing: 'both',
    });
    const strikes = paths.flatMap((path) => {
      const first = path.runs[0]?.[0];
      if (first === undefined) return [];
      const details = impactDetails(path.impact);
      return [
        {
          id: path.impact.id,
          name: path.impact.name,
          longitude: first.longitude,
          latitude: first.latitude,
          time: -first.ma,
          dating: path.tight ? TIGHT : LOOSE,
          age: path.impact.age,
          width:
            path.impact.diameterKm === null ? 'not known' : `${String(path.impact.diameterKm)} km`,
          travelled: `${Math.round(pathKm(path)).toLocaleString('en')} km`,
          size: Math.log10(1 + (path.impact.diameterKm ?? 1)),
          where: details.title,
        },
      ];
    });
    const chart = view.scene.add(
      charts.chart({
        mark: 'point',
        theme: 'dark',
        box: BOX,
        data: strikes,
        x: { field: 'longitude', title: 'Longitude', scale: { domain: [-180, 180] } },
        z: { field: 'latitude', title: 'Latitude', scale: { domain: [-90, 90] } },
        y: {
          field: 'time',
          title: 'Ma ago',
          scale: { domain: [-reach, 0], nice: false },
          format: (value: number) => String(Math.round(-value)),
        },
        color: {
          field: 'dating',
          title: 'Dating',
          scale: { domain: [TIGHT, LOOSE], range: ['#ff8a3d', '#8a93a8'] },
        },
        size: { field: 'size', scale: { range: [0.04, 0.22] } },
        legend: { container: legend },
        tooltip: ['name', 'age', 'width', 'travelled'],
      }),
    );
    const { x, y, z } = chart.scales;
    const at = (point: { longitude: number; latitude: number }, ma: number) =>
      [
        x === undefined ? 0 : x(point.longitude),
        y === undefined ? 0 : y(-ma),
        z === undefined ? 0 : z(point.latitude),
      ] as const;

    // Today's coasts on the top face, for bearings.
    const coastLines: number[] = [];
    for (const country of coasts) {
      for (const ring of country) {
        for (let step = 1; step < ring.length; step++) {
          const a = ring[step - 1];
          const b = ring[step];
          if (a === undefined || b === undefined) continue;
          // Some outlines run past 180° (Antarctica's to 540°): wrapped, and broken where they
          // cross the antimeridian.
          const from = wrap(a[0]);
          const to = wrap(b[0]);
          if (Math.abs(from - to) > 180) continue;
          coastLines.push(
            ...at({ longitude: from, latitude: a[1] }, 0),
            ...at({ longitude: to, latitude: b[1] }, 0),
          );
        }
      }
    }
    // The paths: those dated closely in colour, the loose ones faint.
    const segments = (tight: boolean): number[] => {
      const out: number[] = [];
      for (const path of paths) {
        if (path.tight !== tight) continue;
        for (const run of path.runs) out.push(...runSegments(run, at));
      }
      return out;
    };
    chart.add(
      new phoria.Lines({
        geometry: new phoria.Geometry({ positions: coastLines }),
        material: { color: '#4a6a9a', width: 1, unlit: true, opacity: 0.7 },
        pickable: false,
      }),
      new phoria.Lines({
        geometry: new phoria.Geometry({ positions: segments(true) }),
        material: { color: '#ff8a3d', width: 1.5, unlit: true, opacity: 0.8 },
        pickable: false,
      }),
      new phoria.Lines({
        geometry: new phoria.Geometry({ positions: segments(false) }),
        material: { color: '#8a93a8', width: 1, unlit: true, opacity: 0.35 },
        pickable: false,
      }),
    );
    const playhead = chart.add(
      new phoria.Mesh({
        geometry: phoria.plane({ width: BOX[0], depth: BOX[2] }),
        material: { color: '#9bc4ff', opacity: 0.12, unlit: true, doubleSided: true },
        pickable: false,
      }),
    );
    view.on('click', (hit) => {
      const datum: unknown = hit?.datum;
      const id =
        typeof datum === 'object' && datum !== null && 'id' in datum ? datum.id : undefined;
      if (typeof id === 'number') onRequest({ id });
    });
    view.frame(chart);
    view.start();
    canvas.dataset['craters'] = String(strikes.length);
    const byId = new Map(paths.map((path) => [path.impact.id, path] as const));
    return { view, chart, phoria, playhead, paths: byId, focus: null };
  }

  /** The plane at the slider's moment, within the box. */
  function placePlayhead(scene: Drawn, ma: number): void {
    const { y } = scene.chart.scales;
    const reach = -(y?.domain[0] ?? 0);
    const clamped = Math.min(Math.max(ma, 0), reach);
    const height = y === undefined ? 0 : y(-clamped);
    scene.playhead.position.set(0, height, 0);
  }

  /** Light one crater's path and say where it went; or clear it for all of them. */
  function focusOn(scene: Drawn, view: CratersView): void {
    if (scene.focus !== null) scene.chart.remove(scene.focus);
    scene.focus = null;
    const path = view === 'all' ? undefined : scene.paths.get(view.id);
    if (path === undefined) {
      focus.replaceChildren(
        ...(view === 'all'
          ? []
          : [element('p', {}, 'No path is drawn for that crater; here are all of them.')]),
      );
      return;
    }
    const { x, y, z } = scene.chart.scales;
    const at = (point: { longitude: number; latitude: number }, ma: number) =>
      [
        x === undefined ? 0 : x(point.longitude),
        y === undefined ? 0 : y(-ma),
        z === undefined ? 0 : z(point.latitude),
      ] as const;
    const { phoria } = scene;
    const group = new phoria.Group({ name: 'crater' });
    const first = path.runs[0]?.[0];
    group.add(
      new phoria.Lines({
        geometry: new phoria.Geometry({
          positions: path.runs.flatMap((run) => runSegments(run, at)),
        }),
        material: { color: '#ffffff', width: 4, unlit: true },
        pickable: false,
      }),
      ...(first === undefined
        ? []
        : [
            new phoria.Label({
              text: path.impact.name,
              position: [...at(first, first.ma)],
              className: 'tree-label-focus',
              priority: 10,
              overlap: 'show',
            }),
          ]),
    );
    scene.chart.add(group);
    scene.focus = group;

    const globe = element(
      'button',
      { type: 'button', class: 'why-all' },
      `See it on the globe, ${String(Math.round(path.fromMa))} million years ago`,
    );
    globe.addEventListener('click', () => {
      if (first !== undefined) onGlobe(path.fromMa, first);
    });
    focus.replaceChildren(
      element('h3', {}, path.impact.name),
      element(
        'p',
        { class: 'stage-note' },
        `${path.impact.age} million years old, ${path.impact.diameterKm === null ? 'width not known' : `${String(path.impact.diameterKm)} km across`}. Carried about ${Math.round(pathKm(path)).toLocaleString('en')} km by its plate${path.beyondReach ? ' since 540 million years ago, as far back as the reconstruction reaches' : ' since it struck'}.`,
      ),
      globe,
    );
  }

  function show(view: CratersView | null, ma: number): void {
    wantedMa = ma;
    if (drawn !== null) placePlayhead(drawn, ma);
    const key = view === null ? '' : view === 'all' ? 'all' : String(view.id);
    if (key === shownKey) return;
    shownKey = key;
    wanted = view;
    if (view === null) {
      if (dialog.open) dialog.close();
      drawn?.view.stop();
      return;
    }
    if (!dialog.open) dialog.show();
    if (drawn !== null) {
      drawn.view.start();
      focusOn(drawn, view);
      return;
    }
    starting ??= start().then(
      () => {
        if (drawn === null) return;
        placePlayhead(drawn, wantedMa);
        if (wanted !== null) focusOn(drawn, wanted);
      },
      (error: unknown) => {
        starting = null;
        shownKey = '';
        status.hidden = false;
        status.textContent = `Could not draw the paths: ${errorMessage(error)}`;
      },
    );
  }

  return { dialog, show };
}

/** A run as line segments, each point to the next, in the box's units. */
function runSegments(
  run: readonly PathPoint[],
  at: (point: PathPoint, ma: number) => readonly [number, number, number],
): number[] {
  const out: number[] = [];
  for (let step = 1; step < run.length; step++) {
    const a = run[step - 1];
    const b = run[step];
    if (a === undefined || b === undefined) continue;
    out.push(...at(a, a.ma), ...at(b, b.ma));
  }
  return out;
}

/** A longitude in −180..180. */
function wrap(longitude: number): number {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}
