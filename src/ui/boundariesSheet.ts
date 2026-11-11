/**
 * The planetary boundaries' story (#434): a sheet over the globe with the 3D wheel, its three
 * chapters, a caption for each, and the table of values it draws, both assessments side by side
 * with the report's own notes where they differ. The sheet follows the view, so a link opens it
 * at the same chapter.
 *
 * The scene's code and the data load the first time the sheet opens. DOM glue, covered by the
 * Playwright suite; the numbers are in `data/planetaryBoundaries.ts`, the scene in
 * `story/boundaryWheel.ts`.
 */

import {
  statusOf,
  valueText,
  variableReach,
  zoneOf,
  type PlanetaryBoundaries,
  type Status,
  type Zone,
} from '../data/planetaryBoundaries';
import { BOUNDARY_CHAPTERS, type BoundaryChapter } from '../state/viewState';
import type { BoundaryWheel } from '../story/boundaryWheel';
import { errorMessage } from '../util/errors';
import { element } from './dom';
import { uiIcon } from './icons';
import './stageSheet.css';
import './boundariesSheet.css';

export interface BoundariesSheet {
  readonly dialog: HTMLDialogElement;
  /** The button that opens it, for the header's tools. */
  readonly button: HTMLButtonElement;
  /** Open at a chapter, or close (null). */
  show(chapter: BoundaryChapter | null): void;
}

const CHAPTER_NAMES: Readonly<Record<BoundaryChapter, string>> = {
  safe: 'Safe space',
  pressure: 'Pressure',
  compare: '2023 vs 2026',
};

const CAPTIONS: Readonly<Record<BoundaryChapter, string>> = {
  safe: 'Nine processes keep Earth in the stable state of the last 11,700 years, the Holocene, in which farming and cities arose. Each has a boundary to human pressure: inside it (green), the risk of destabilising the planet stays low. Here every one is at its pre-industrial or Holocene-like level.',
  pressure:
    'Each wedge grows to its value in the Planetary Health Check 2026. Past the dark green ring a boundary is crossed, and the risk grows (amber); past the orange line it is high (red). Seven of the nine are crossed; only aerosols, globally, and the ozone layer are within.',
  compare:
    'Pale bars: the same variables in Richardson et al. (2023), six of nine crossed. Ocean acidification has crossed since, by a hair. Where the two disagree, or the report says a change is one of method, a “!” marks it: see the notes in the table.',
};

const ZONE_WORDS: Readonly<Record<Zone, string>> = {
  safe: 'safe',
  increasing: 'increasing risk',
  high: 'high risk',
};

const STATUS_WORDS: Readonly<Record<Status, string>> = {
  within: 'within',
  transgressed: 'transgressed',
  strongly: 'strongly transgressed',
};

/** The table of values: for each boundary, its status, then each variable in both assessments. */
function valuesTable(data: PlanetaryBoundaries): HTMLElement {
  const zoneCell = (reach: number | undefined) =>
    reach === undefined
      ? element('td', {}, '—')
      : element('td', { class: `is-${zoneOf(reach)}` }, ZONE_WORDS[zoneOf(reach)]);
  const rows = data.boundaries.flatMap((boundary) => {
    const status = statusOf(boundary, 'phc2026') ?? 'within';
    return [
      element(
        'tr',
        { class: 'boundary-row' },
        element(
          'th',
          { colspan: '4', scope: 'rowgroup' },
          `${boundary.name}: ${STATUS_WORDS[status]}`,
          element('span', { class: 'boundary-summary' }, ` ${boundary.summary}`),
        ),
      ),
      ...boundary.variables.flatMap((variable) => {
        const now = variableReach(variable, 'phc2026');
        const row = element(
          'tr',
          { 'data-variable': variable.id },
          element(
            'th',
            { scope: 'row' },
            variable.name,
            variable.proposed === true ? ' (proposed)' : '',
          ),
          element('td', {}, valueText(variable, 'richardson2023') ?? '—'),
          element('td', {}, valueText(variable, 'phc2026') ?? '—'),
          zoneCell(now?.low),
        );
        return variable.note === undefined
          ? [row]
          : [
              row,
              element(
                'tr',
                { class: 'boundary-note' },
                element('td', { colspan: '4' }, `! ${variable.note}`),
              ),
            ];
      }),
    ];
  });
  return element(
    'table',
    { class: 'boundary-table', 'data-testid': 'boundary-table' },
    element(
      'thead',
      {},
      element(
        'tr',
        {},
        element('th', { scope: 'col' }, 'Control variable'),
        element('th', { scope: 'col' }, '2023'),
        element('th', { scope: 'col' }, '2026'),
        element('th', { scope: 'col' }, 'Zone, 2026'),
      ),
    ),
    element('tbody', {}, ...rows),
  );
}

export function createBoundariesSheet(
  /** Asked to open at a chapter, or to close: the view decides. */
  onRequest: (chapter: BoundaryChapter | null) => void,
  /** The data, loaded the first time it is needed. */
  load: () => Promise<PlanetaryBoundaries>,
  earthTextureUrl: string,
  /** The book that says where the numbers come from. */
  why: HTMLElement,
): BoundariesSheet {
  const close = element(
    'button',
    { type: 'button', class: 'famous-close', 'aria-label': 'Close' },
    '×',
  );
  const tabs = BOUNDARY_CHAPTERS.map((chapter) => {
    const tab = element(
      'button',
      { type: 'button', class: 'boundary-tab', 'aria-pressed': 'false' },
      CHAPTER_NAMES[chapter],
    );
    tab.addEventListener('click', () => {
      onRequest(chapter);
    });
    return { chapter, tab };
  });
  const play = element('button', { type: 'button', class: 'boundary-play' }, 'Pause');
  const again = element('button', { type: 'button', class: 'boundary-play' }, 'Again');
  const caption = element('p', { class: 'boundary-caption', 'data-testid': 'boundary-caption' });
  const status = element('p', { class: 'stage-status', role: 'status' }, 'Loading…');
  const stage = element('div', { class: 'boundary-stage', 'data-testid': 'boundary-stage' });
  const table = element('div', { class: 'boundary-values' });
  const dialog = element(
    'dialog',
    {
      class: 'famous-dialog stage-sheet',
      'aria-labelledby': 'boundaries-title',
      'data-testid': 'boundaries-sheet',
    },
    element(
      'header',
      { class: 'famous-header' },
      element('h2', { id: 'boundaries-title' }, 'Planetary boundaries ', why),
      close,
    ),
    element(
      'div',
      { class: 'stage-body' },
      element(
        'div',
        { class: 'boundary-controls', role: 'group', 'aria-label': 'Chapters' },
        ...tabs.map(({ tab }) => tab),
        play,
        again,
      ),
      stage,
      status,
      caption,
      table,
      element(
        'p',
        { class: 'stage-legend' },
        'From the ',
        element(
          'a',
          { href: 'https://doi.org/10.48485/pik.2026.25' },
          'Planetary Health Check 2026',
        ),
        ' (Caesar, Sakschewski et al., PBScience, Potsdam Institute for Climate Impact Research), CC BY 4.0, and ',
        element(
          'a',
          { href: 'https://doi.org/10.1126/sciadv.adh2458' },
          'Richardson et al. (2023)',
        ),
        '. The drawing is this site’s own.',
      ),
    ),
  );
  const button = element(
    'button',
    {
      type: 'button',
      class: 'boundaries-open',
      'aria-haspopup': 'dialog',
      'aria-expanded': 'false',
      title: 'Planetary boundaries: the state of the planet in 2026',
    },
    uiIcon('boundaries'),
    element('span', { class: 'icon-label' }, 'Boundaries'),
  );
  button.addEventListener('click', () => {
    onRequest(dialog.open ? null : 'safe');
  });
  close.addEventListener('click', () => {
    onRequest(null);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dialog.open) onRequest(null);
  });

  const lessMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let wheel: BoundaryWheel | null = null;
  let starting: Promise<void> | null = null;
  let wanted: BoundaryChapter | null = null;
  let shown: BoundaryChapter | null = null;
  let playing = true;

  function setPlaying(next: boolean): void {
    playing = next;
    play.textContent = next ? 'Pause' : 'Play';
    wheel?.setPlaying(next);
  }
  play.addEventListener('click', () => {
    setPlaying(!playing);
  });
  again.addEventListener('click', () => {
    wheel?.restart();
    setPlaying(true);
  });

  /** Turn the wheel to `chapter` and start it, or show it complete for less motion. */
  function turnTo(chapter: BoundaryChapter): void {
    if (wheel === null) return;
    wheel.setChapter(chapter);
    if (lessMotion.matches) {
      wheel.settle();
      playing = false;
      play.textContent = 'Play';
    } else {
      wheel.restart();
      setPlaying(true);
    }
  }

  async function start(): Promise<void> {
    const [data, { createBoundaryWheel }] = await Promise.all([
      load(),
      import('../story/boundaryWheel'),
    ]);
    table.replaceChildren(valuesTable(data));
    status.hidden = true;
    // The sheet may have closed while it loaded.
    if (!dialog.open || wheel !== null) return;
    wheel = createBoundaryWheel(stage, { data, earthTextureUrl });
  }

  function show(chapter: BoundaryChapter | null): void {
    // Called on every render: act only when the chapter changes.
    if (chapter === shown) return;
    shown = chapter;
    wanted = chapter;
    button.setAttribute('aria-expanded', String(chapter !== null));
    if (chapter === null) {
      if (dialog.open) dialog.close();
      // The WebGL context goes with the sheet; it is made again on opening.
      wheel?.dispose();
      wheel = null;
      starting = null;
      return;
    }
    for (const { chapter: each, tab } of tabs)
      tab.setAttribute('aria-pressed', String(each === chapter));
    caption.textContent = CAPTIONS[chapter];
    // Not modal: the globe stays in reach, as the other sheets leave it.
    if (!dialog.open) dialog.show();
    if (wheel !== null) {
      turnTo(chapter);
      return;
    }
    starting ??= start().then(
      () => {
        if (wanted !== null) turnTo(wanted);
      },
      (error: unknown) => {
        starting = null;
        status.hidden = false;
        status.textContent = `Could not draw the boundaries: ${errorMessage(error)}`;
      },
    );
  }

  return { dialog, button, show };
}
