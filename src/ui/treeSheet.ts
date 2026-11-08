/**
 * The tree of life (#300): a sheet over the globe with the whole tree in 3D, a radial tree from
 * the first cells outward, coloured by the groups the site shows. Hover names a taxon; a click
 * lights its line back to the root and lists it, each step a link to that group. The sheet
 * follows the view, so a link opens it at the same taxon.
 *
 * phoria2 draws it, loaded only when the sheet first opens, so the globe's first paint does not
 * wait for it. DOM and WebGL glue, covered by the Playwright suite; the layout is in
 * `data/treeLayout.ts`.
 */

import type * as Phoria2 from 'phoria2';
import type * as Phoria2Charts from 'phoria2/charts';

import type { TreeOfLife } from '../data/treeOfLife';
import { hasFlag, lineage } from '../data/treeOfLife';
import { nodeOfOtt, TREE_CLADES, treeLayout, type TreeLayout } from '../data/treeLayout';
import type { TreeView } from '../state/viewState';
import { elementAt, valueAt } from '../util/arrays';
import { errorMessage } from '../util/errors';
import { element } from './dom';

export interface TreeSheet {
  readonly dialog: HTMLDialogElement;
  /** Open at the whole tree or a taxon, or close (null). */
  show(view: TreeView | null): void;
}

/** One colour per group, `other` first: the order of `TREE_CLADES`. */
const PALETTE = [
  '#5b6478',
  '#9c6644',
  '#c9a227',
  '#2a9d8f',
  '#8ab17d',
  '#e9c46a',
  '#90be6d',
  '#43aa8b',
  '#a26cf0',
  '#f8961e',
  '#4d908e',
  '#f3722c',
  '#f94144',
  '#ffd166',
  '#4cc9f0',
  '#3a86ff',
  '#ff006e',
  '#9bf6ff',
  '#f15bb5',
  '#ffffff',
] as const;
const CLADE_DOMAIN = ['other', ...TREE_CLADES];

/** Named groups labelled on the whole tree. */
const LANDMARKS = new Set<string>([
  ...TREE_CLADES,
  'Eukaryota',
  'Metazoa',
  'Vertebrata',
  'Tetrapoda',
  'Primates',
  'Embryophyta',
]);

/** The disc's size in the view's units. */
const SIZE = 10;

type Phoria = typeof Phoria2;
type Charts = typeof Phoria2Charts;

interface Drawn {
  readonly view: InstanceType<Phoria['View']>;
  readonly chart: ReturnType<Charts['chart']>;
  readonly phoria: Phoria;
  overlay: InstanceType<Phoria['Group']> | null;
}

export function createTreeSheet(
  /** Asked to open at a taxon, the whole tree, or to close: the view decides. */
  onRequest: (view: TreeView | null) => void,
  /** The tree, loaded the first time it is needed. */
  load: () => Promise<TreeOfLife>,
  /** The book that says where the tree comes from. */
  why: HTMLElement,
): TreeSheet {
  const close = element(
    'button',
    { type: 'button', class: 'famous-close', 'aria-label': 'Close' },
    '×',
  );
  const status = element('p', { class: 'stage-status', role: 'status' }, 'Loading the tree…');
  const canvas = element('canvas', {
    class: 'stage-canvas',
    'data-testid': 'tree-canvas',
    'aria-label': 'The tree of life in 3D: drag to turn it, scroll to zoom',
  });
  const legend = element('div', { class: 'stage-legend' });
  // The canvas joins the page only when the tree is first drawn: until then the globe's is the
  // page's only canvas.
  const stage = element('div', { class: 'stage-frame' }, legend);
  const focus = element('div', { class: 'stage-focus', 'data-testid': 'tree-focus' });
  const whole = element('button', { type: 'button', class: 'why-all' }, 'The whole tree');
  const dialog = element(
    'dialog',
    { class: 'famous-dialog stage-sheet', 'aria-labelledby': 'tree-title' },
    element(
      'header',
      { class: 'famous-header' },
      element('h2', { id: 'tree-title' }, 'Tree of life ', why),
      close,
    ),
    element(
      'div',
      { class: 'stage-body' },
      stage,
      status,
      focus,
      element(
        'p',
        { class: 'stage-note' },
        'Who is related to whom, not when they split: distance from the centre counts branchings, not years. Dimmer taxa are placed by the taxonomy alone, with no published phylogeny behind them.',
      ),
      element('div', { class: 'why-actions' }, whole),
    ),
  );
  close.addEventListener('click', () => {
    onRequest(null);
  });
  whole.addEventListener('click', () => {
    onRequest('all');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dialog.open) onRequest(null);
  });

  let tree: TreeOfLife | null = null;
  let layout: TreeLayout | null = null;
  let drawn: Drawn | null = null;
  let starting: Promise<void> | null = null;
  let wanted: TreeView | null = null;

  /** Load the tree and phoria2, and draw the whole tree once. */
  async function start(): Promise<void> {
    const [loaded, phoria, charts] = await Promise.all([
      load(),
      import('phoria2'),
      import('phoria2/charts'),
    ]);
    stage.prepend(canvas);
    tree = loaded;
    layout = treeLayout(loaded);
    drawn = draw(loaded, layout, phoria, charts);
    status.textContent = '';
    status.hidden = true;
  }

  function draw(data: TreeOfLife, placed: TreeLayout, phoria: Phoria, charts: Charts): Drawn {
    const view = new phoria.View({
      canvas,
      orbit: { minDistance: 2, maxDistance: 40 },
      camera: { position: [0, 9, 9], target: [0, 0, 0] },
      framing: 'both',
    });
    const nodes = data.name.map((name, node) => ({
      id: node,
      name: name === '' ? '(an unnamed branch)' : name,
      rank: data.ranks[valueAt(data.rank, node)] ?? '',
      group: elementAt(placed.clade, node),
      status: hasFlag(data, node, 'extinct') ? 'extinct' : 'living',
      placed: hasFlag(data, node, 'taxonomyOnly') ? 'by the taxonomy alone' : 'by phylogenies',
      tips: valueAt(placed.tips, node),
      x: valueAt(placed.x, node),
      z: valueAt(placed.z, node),
      tag: LANDMARKS.has(name) ? name : '',
      size: Math.cbrt(valueAt(placed.tips, node) / valueAt(placed.tips, 0)),
      opacity: hasFlag(data, node, 'taxonomyOnly') ? 0.45 : 1,
    }));
    const links = data.parent.flatMap((parent, node) =>
      parent === -1 ? [] : [{ source: parent, target: node, group: elementAt(placed.clade, node) }],
    );
    const colours = { domain: CLADE_DOMAIN, range: [...PALETTE] };
    const chart = view.scene.add(
      charts.chart({
        mark: 'network',
        layout: 'given',
        theme: 'dark',
        box: [SIZE, 0.01, SIZE],
        data: { nodes, links },
        x: { field: 'x', scale: { domain: [-1, 1] } },
        z: { field: 'z', scale: { domain: [-1, 1] } },
        color: { field: 'group', title: 'Group', scale: colours },
        // phoria2 maps the data's own extent onto these ranges, in the view's units: tips a
        // speck, the root a bead; taxa placed by the taxonomy alone fainter.
        size: { field: 'size', scale: { range: [0.012, 0.07] } },
        opacity: { field: 'opacity', scale: { range: [0.45, 1] } },
        label: 'tag',
        overlap: 'hide',
        link: { width: 1, opacity: 0.55, color: { field: 'group', scale: colours } },
        legend: { container: legend },
        highlight: 'neighbours',
        tooltip: ['name', 'rank', 'group', 'status', 'placed', 'tips'],
      }),
    );
    // A 'given' network gets a chart's frame: the tree has no axes to show.
    for (const child of chart.children) if (child.name === 'axes') child.visible = false;
    view.on('click', (hit) => {
      const datum: unknown = hit?.datum;
      const node =
        typeof datum === 'object' && datum !== null && 'id' in datum ? datum.id : undefined;
      if (typeof node === 'number') onRequest({ ott: valueAt(data.ott, node) });
    });
    view.frame(chart);
    view.start();
    // How many taxa it drew, for the end-to-end tests to wait on.
    canvas.dataset['nodes'] = String(nodes.length);
    return { view, chart, phoria, overlay: null };
  }

  /** Light one taxon's line to the root, and list it; or clear both for the whole tree. */
  function focusOn(view: TreeView): void {
    if (tree === null || layout === null || drawn === null) return;
    const data = tree;
    const placed = layout;
    const scene = drawn;
    if (scene.overlay !== null) scene.chart.remove(scene.overlay);
    scene.overlay = null;
    const node = view === 'all' ? null : nodeOfOtt(data, view.ott);
    if (node === null) {
      focus.replaceChildren(
        ...(view === 'all'
          ? []
          : [element('p', {}, 'This tree does not hold that taxon; here is the whole tree.')]),
      );
      return;
    }
    const line = lineage(data, node);
    const { x, z } = scene.chart.scales;
    const at = (each: number): [number, number, number] => [
      x === undefined ? 0 : x(valueAt(placed.x, each)),
      0.02,
      z === undefined ? 0 : z(valueAt(placed.z, each)),
    ];
    const positions: number[] = [];
    for (let step = 0; step + 1 < line.length; step++) {
      positions.push(...at(elementAt(line, step)), ...at(elementAt(line, step + 1)));
    }
    const { phoria } = scene;
    const overlay = new phoria.Group({ name: 'lineage' });
    overlay.add(
      new phoria.Lines({
        geometry: new phoria.Geometry({ positions }),
        material: { color: '#ffffff', width: 3, unlit: true },
        pickable: false,
      }),
      new phoria.Label({
        text: elementAt(data.name, node) || '(an unnamed branch)',
        position: at(node),
        className: 'tree-label-focus',
        priority: 10,
        overlap: 'show',
      }),
    );
    scene.chart.add(overlay);
    scene.overlay = overlay;

    const named = line.filter((each) => elementAt(data.name, each) !== '');
    focus.replaceChildren(
      element(
        'h3',
        {},
        elementAt(data.name, node) || '(an unnamed branch)',
        hasFlag(data, node, 'extinct') ? ' †' : '',
      ),
      element(
        'ol',
        { class: 'tree-lineage', 'aria-label': 'Its line back to the first cells' },
        ...named
          .slice(1)
          .map((each) =>
            element('li', {}, crumb(elementAt(data.name, each), valueAt(data.ott, each))),
          ),
      ),
    );
  }

  function crumb(name: string, ott: number): HTMLButtonElement {
    const button = element('button', { type: 'button', class: 'tree-crumb' }, name);
    button.addEventListener('click', () => {
      onRequest({ ott });
    });
    return button;
  }

  let shownKey = '';

  function show(view: TreeView | null): void {
    // Called on every render: act only when what the tree shows changes.
    const key = view === null ? '' : view === 'all' ? 'all' : `ott${String(view.ott)}`;
    if (key === shownKey) return;
    shownKey = key;
    wanted = view;
    if (view === null) {
      if (dialog.open) dialog.close();
      drawn?.view.stop();
      return;
    }
    // Not modal: the globe stays in reach, as the other sheets leave it.
    if (!dialog.open) dialog.show();
    if (drawn !== null) {
      drawn.view.start();
      focusOn(view);
      return;
    }
    starting ??= start().then(
      () => {
        if (wanted !== null) focusOn(wanted);
      },
      (error: unknown) => {
        starting = null;
        status.hidden = false;
        status.textContent = `Could not draw the tree: ${errorMessage(error)}`;
      },
    );
  }

  return { dialog, show };
}
