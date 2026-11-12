/**
 * The planetary boundaries' story (#434): a sheet over the globe with the 3D wheel, its three
 * chapters, a caption for each, and the table of values it draws, both assessments side by side
 * with the report's own notes where they differ. The sheet follows the view, so a link opens it
 * at the same chapter.
 *
 * It opens on the Holocene (#453): a chart of temperature over 800,000 years, the stable band
 * the boundaries are set to keep the planet in. The other chapters are the wheel's. As the
 * chart draws, `onYear` hears the year its line has reached, and null on leaving it (#475).
 *
 * The scenes' code and the data load the first time the sheet opens; the wheel's WebGL only
 * when one of its chapters is first shown. DOM glue, covered by the Playwright suite; the
 * numbers are in `data/planetaryBoundaries.ts` and `data/holoceneTemperature.ts`, the scenes in
 * `story/boundaryWheel.ts` and `story/holoceneChart.ts`.
 */

import type { Fetch } from '../../data/fetchJson';
import { loadHoloceneTemperature, type HoloceneTemperature } from '../../data/holoceneTemperature';
import {
  loadPlanetaryBoundaries,
  statusOf,
  valueText,
  variableReach,
  zoneOf,
  type PlanetaryBoundaries,
  type Status,
  type Zone,
} from '../../data/planetaryBoundaries';
import { BOUNDARY_CHAPTERS, type BoundaryChapter } from '../../state/viewState';
import type { BoundaryWheel, createBoundaryWheel } from './boundaryWheel';
import type { createHoloceneChart } from './holoceneChart';
import type { StoryScene } from '../../story/storyScene';
import { errorMessage } from '../../util/errors';
import { element } from '../../ui/dom';
import { uiIcon } from '../../ui/icons';
import '../../ui/stageSheet.css';
import './boundariesSheet.css';

export interface BoundariesSheet {
  readonly dialog: HTMLDialogElement;
  /** The button that opens it, for the header's tools. */
  readonly button: HTMLButtonElement;
  /** Open at a chapter, or close (null). */
  show(chapter: BoundaryChapter | null): void;
}

const CHAPTER_NAMES: Readonly<Record<BoundaryChapter, string>> = {
  holocene: 'Holocene',
  safe: 'Safe space',
  pressure: 'Pressure',
  compare: '2023 vs 2026',
};

const CAPTIONS: Readonly<Record<BoundaryChapter, string>> = {
  holocene:
    'For 800,000 years temperature swung with the ice ages: at the last one’s depth, about 20,000 years ago, the globe was some 7 °C colder (Antarctica, faint, swung about twice as far). Then for 10,000 years before industry it kept within about a degree: the Holocene corridor (green), in which farming and cities arose. In 2025 it was 1.4 °C above 1850–1900, out of the corridor. The records differ on the corridor’s slow trend: the reanalysis drawn here has it warming slightly, others cooling. The globe follows the line: the ice sheets and the coast of the time, and land coloured blue where colder and orange to red where warmer, left uncoloured within about a degree. From 1850 the colours are measured warming since 1850–1900; land has warmed faster than the globe, some 2 °C.',
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
  /** Where a data file is served, and how to fetch it: loaded the first time the sheet opens. */
  dataUrl: (file: string) => string,
  fetchJson: Fetch,
  earthTextureUrl: string,
  /** The book that says where the numbers come from. */
  why: HTMLElement,
  /** The year the Holocene chart's line has reached; null when it is no longer shown. */
  onYear: (year: number | null) => void = () => undefined,
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
  const chartStage = element('div', {
    class: 'boundary-stage holocene-stage',
    'data-testid': 'holocene-stage',
  });
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
      chartStage,
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
        '. Temperature: ',
        element('a', { href: 'https://doi.org/10.1594/PANGAEA.683655' }, 'EPICA Dome C'),
        ' (Jouzel et al. 2007, CC BY 3.0), ',
        element('a', { href: 'https://doi.org/10.1038/s41586-021-03984-4' }, 'Osman et al. (2021)'),
        ', ',
        element('a', { href: 'https://doi.org/10.1038/s41561-019-0400-0' }, 'PAGES 2k (2019)'),
        ' (both from NOAA NCEI, accessed 12 November 2026; no licence stated, cited as NOAA asks) and ',
        element('a', { href: 'https://doi.org/10.1029/2019JD032361' }, 'HadCRUT5'),
        ' (Met Office, Open Government Licence v3), as the report’s Figure 1 cites them. On the globe as the chart draws: land temperature from ',
        element('a', { href: 'https://doi.org/10.1038/s41597-021-01009-3' }, 'Krapp et al. (2021)'),
        ' (CC BY 4.0) and, from 1850, ',
        element('a', { href: 'https://doi.org/10.5194/essd-12-3469-2020' }, 'Berkeley Earth'),
        ' (Rohde & Hausfather 2020; CC BY-NC 4.0); ice sheets from ',
        element('a', { href: 'https://doi.org/10.1594/PANGAEA.905800' }, 'PaleoMIST 1.0'),
        ' (Gowan et al. 2021, CC BY 4.0) with ',
        element('a', { href: 'https://osf.io/7jen3/' }, 'Batchelor et al. (2019)'),
        '’s outlines (no licence stated) and today’s ice to the coast from ',
        element('a', { href: 'https://www.naturalearthdata.com' }, 'Natural Earth'),
        ' (public domain); sea level from ',
        element(
          'a',
          { href: 'https://doi.org/10.1038/nature07158' },
          'Bintanja & van de Wal (2008)',
        ),
        ' (via NOAA, no licence stated), laid on NOAA’s ',
        element(
          'a',
          { href: 'https://www.ncei.noaa.gov/products/etopo-global-relief-model' },
          'ETOPO1',
        ),
        ' depths (public domain); sea ice from the ',
        element('a', { href: 'https://doi.org/10.7265/a98x-0f50' }, 'NSIDC Sea Ice Index'),
        ' (free to use, cited) and the ',
        element('a', { href: 'https://doi.org/10.5194/cp-17-1065-2021' }, 'PMIP4'),
        ' glacial runs (CC BY 4.0). The drawings are this site’s own.',
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
    onRequest(dialog.open ? null : 'holocene');
  });
  close.addEventListener('click', () => {
    onRequest(null);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dialog.open) onRequest(null);
  });

  const lessMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  interface Loaded {
    readonly boundaries: PlanetaryBoundaries;
    readonly temperature: HoloceneTemperature;
    readonly makeWheel: typeof createBoundaryWheel;
    readonly makeChart: typeof createHoloceneChart;
  }
  let loaded: Loaded | null = null;
  let wheel: BoundaryWheel | null = null;
  let chart: StoryScene<'holocene'> | null = null;
  let starting: Promise<void> | null = null;
  let shown: BoundaryChapter | null = null;
  let playing = true;

  /** The scene of the chapter shown: the chart or the wheel. */
  const current = () => (shown === 'holocene' ? chart : wheel);

  function setPlaying(next: boolean): void {
    playing = next;
    play.textContent = next ? 'Pause' : 'Play';
    current()?.setPlaying(next);
  }
  play.addEventListener('click', () => {
    setPlaying(!playing);
  });
  again.addEventListener('click', () => {
    current()?.restart();
    setPlaying(true);
  });

  /** Turn to `chapter`, on the chart or the wheel, and start it, or show it complete. */
  function turnTo(chapter: BoundaryChapter): void {
    if (loaded === null) return;
    const { boundaries, temperature, makeWheel, makeChart } = loaded;
    chartStage.hidden = chapter !== 'holocene';
    stage.hidden = chapter === 'holocene';
    let scene: Pick<StoryScene<string>, 'restart' | 'settle'>;
    if (chapter === 'holocene') {
      wheel?.setPlaying(false);
      chart ??= makeChart(chartStage, temperature, onYear);
      scene = chart;
    } else {
      chart?.setPlaying(false);
      onYear(null);
      // Made once a wheel chapter is first shown, its stage then laid out.
      wheel ??= makeWheel(stage, { data: boundaries, earthTextureUrl });
      wheel.setChapter(chapter);
      scene = wheel;
    }
    if (lessMotion.matches) {
      scene.settle();
      playing = false;
      play.textContent = 'Play';
    } else {
      scene.restart();
      setPlaying(true);
    }
  }

  async function start(): Promise<void> {
    const [boundaries, temperature, { createBoundaryWheel }, { createHoloceneChart }] =
      await Promise.all([
        loadPlanetaryBoundaries(dataUrl('planetary-boundaries.json'), fetchJson),
        loadHoloceneTemperature(dataUrl('holocene-temperature.json'), fetchJson),
        import('./boundaryWheel'),
        import('./holoceneChart'),
      ]);
    table.replaceChildren(valuesTable(boundaries));
    status.hidden = true;
    loaded = {
      boundaries,
      temperature,
      makeWheel: createBoundaryWheel,
      makeChart: createHoloceneChart,
    };
  }

  function show(chapter: BoundaryChapter | null): void {
    // Called on every render: act only when the chapter changes.
    if (chapter === shown) return;
    shown = chapter;
    button.setAttribute('aria-expanded', String(chapter !== null));
    if (chapter === null) {
      if (dialog.open) dialog.close();
      // The WebGL context goes with the sheet; it is made again on opening.
      wheel?.dispose();
      chart?.dispose();
      wheel = null;
      chart = null;
      onYear(null);
      return;
    }
    for (const { chapter: each, tab } of tabs)
      tab.setAttribute('aria-pressed', String(each === chapter));
    caption.textContent = CAPTIONS[chapter];
    // Not modal: the globe stays in reach, as the other sheets leave it.
    if (!dialog.open) dialog.show();
    if (loaded !== null) {
      turnTo(chapter);
      return;
    }
    starting ??= start().then(
      () => {
        // The sheet may have closed, or turned, while it loaded.
        if (shown !== null) turnTo(shown);
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
