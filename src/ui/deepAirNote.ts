/**
 * The deep-time bar's note on the air: on the ice-age scale the gases in Antarctic ice, and on
 * the 540-million-year scale CO2 and O2 with their ranges, nitrogen in words, and whose single
 * CO2 estimates the dots show (Foster et al.'s compilation, or the Paleo-CO2 Data Archive's, by
 * method).
 */

import { gasText, type Atmosphere } from '../data/atmosphere';
import { archiveDots, archiveText, studiesNear, type Co2Archive } from '../data/co2Archive';
import {
  co2Text,
  NITROGEN_NOTE,
  O2_TODAY,
  o2Text,
  PREINDUSTRIAL_CO2,
  type DeepAir,
} from '../data/deepAir';
import type { DeepScale } from '../state/viewState';
import { createBandChart } from './bandChart';
import type { DeepTimeView } from './deepTimeBar';
import { element } from './dom';
import { createGasChart } from './gasChart';

export interface DeepAirNote {
  readonly root: HTMLElement;
  /** Say what the air was at `ma`, on the scale shown; hidden while the air is off. */
  render(air: DeepTimeView['air'], scale: DeepScale, oldest: number, ma: number): void;
}

/** Dots for the CO2 chart: their points, and a key that changes when they do. */
interface Dots {
  readonly dots: readonly (readonly [number, number])[];
  readonly key: string;
}

/**
 * Whose CO2 estimates the dots show (Foster et al.'s compilation, or the archive's, by method):
 * the reader's choice, kept while the bar is open; and, for the archive, its estimates near the
 * moment with their studies.
 */
function createCo2Dots(parts: { onCo2Archive(): void; redraw(): void }) {
  const source = element(
    'select',
    { class: 'deep-coast', 'aria-label': 'CO₂ estimates from' },
    element('option', { value: 'foster' }, 'Foster et al. 2017 compilation'),
    element('option', { value: 'archive' }, 'Paleo-CO₂ Data Archive (2025)'),
  );
  const method = element('select', { class: 'deep-coast', 'aria-label': 'CO₂ method' });
  const methods = element('label', { hidden: '' }, ' Method ', method);
  const picker = element(
    'p',
    { class: 'co2-picker' },
    element('label', {}, 'Dots: estimates from ', source),
    methods,
  );
  const archiveNote = element('p', { 'data-testid': 'co2-archive', hidden: '' });
  let methodsListed: Co2Archive | null = null;
  for (const select of [source, method]) {
    select.addEventListener('change', () => {
      if (source.value === 'archive') parts.onCo2Archive();
      parts.redraw();
    });
  }

  /** The Paleo-CO2 Data Archive's dots and words, once it has loaded. */
  function fromArchive(archive: Co2Archive | null, ma: number): Dots {
    methods.hidden = archive === null;
    archiveNote.hidden = false;
    if (archive === null) {
      archiveNote.replaceChildren('Loading the Paleo-CO₂ Data Archive…');
      return { dots: [], key: 'archive-loading' };
    }
    if (methodsListed !== archive) {
      methodsListed = archive;
      method.replaceChildren(
        element('option', { value: '' }, 'All methods'),
        ...archive.methods.map((name, at) => element('option', { value: String(at) }, name)),
      );
    }
    const picked = method.value === '' ? null : Number(method.value);
    archiveNote.replaceChildren(...archiveWords(archive, ma, picked));
    return { dots: archiveDots(archive, picked), key: `archive ${method.value}` };
  }

  return {
    picker,
    archiveNote,
    /** The dots picked for the moment `ma`. */
    dots(deep: DeepAir, archive: Co2Archive | null, ma: number): Dots {
      if (source.value === 'archive') return fromArchive(archive, ma);
      methods.hidden = true;
      archiveNote.hidden = true;
      return {
        dots: deep.co2.proxies.flatMap(({ estimates }) =>
          estimates.map(([at, value]) => [at, value] as const),
        ),
        key: 'foster',
      };
    },
  };
}

/** What the archive says near `ma`, by `method` (null for all), with its studies, credited. */
function archiveWords(
  archive: Co2Archive,
  ma: number,
  method: number | null,
): (string | HTMLElement)[] {
  const studies = studiesNear(archive, ma, 5, method).slice(0, 6);
  return [
    `${archiveText(archive, ma, 5, method)} `,
    ...(studies.length === 0
      ? []
      : [
          'Studies: ',
          ...studies.flatMap(({ label, doi, count }, at) => [
            ...(at === 0 ? [] : [' · ']),
            doi === null
              ? `${label} (${String(count)})`
              : element('a', { href: `https://doi.org/${doi}` }, `${label} (${String(count)})`),
          ]),
          '. ',
        ]),
    element('a', { href: archive.source }, 'Paleo-CO₂ Data Archive'),
    ' (CC BY 4.0).',
  ];
}

type DeepCharts = Readonly<Record<'co2' | 'o2', ReturnType<typeof createBandChart>>>;

/** CO2 with its two ranges and the dots picked, and O2 with its range, over the span shown. */
function drawDeepCharts(charts: DeepCharts, deep: DeepAir, dots: Dots, oldest: number, ma: number) {
  charts.co2.render(
    {
      bands: [
        deep.co2.fit.map(([at, , low95, , , high95]) => [at, low95, high95] as const),
        deep.co2.fit.map(([at, , , low68, high68]) => [at, low68, high68] as const),
      ],
      line: deep.co2.fit.map(([at, best]) => [at, best] as const),
      dots: dots.dots,
      key: dots.key,
      reference: PREINDUSTRIAL_CO2,
    },
    oldest,
    ma,
  );
  charts.o2.render(
    {
      bands: [deep.o2.points.map(([at, , low, high]) => [at, low, high] as const)],
      line: deep.o2.points.map(([at, best]) => [at, best] as const),
      dots: [],
      reference: O2_TODAY,
    },
    oldest,
    ma,
  );
}

/** CO2 at `ma` in words, credited. */
function co2Line(deep: DeepAir, ma: number): HTMLElement {
  return element(
    'p',
    { 'data-testid': 'deep-co2' },
    `${co2Text(deep, ma)} `,
    element('a', { href: `https://doi.org/${deep.co2.doi}` }, 'Foster, Royer & Lunt 2017'),
  );
}

/** O2 at `ma` in words, credited. */
function o2Line(deep: DeepAir, ma: number): HTMLElement {
  return element(
    'p',
    { 'data-testid': 'deep-o2' },
    `${o2Text(deep, ma)} `,
    element('a', { href: `https://doi.org/${deep.o2.doi}` }, 'Mills et al. 2023'),
  );
}

/** Nitrogen in words, with its sources. */
function nitrogenLine(): HTMLElement {
  return element(
    'p',
    { 'data-testid': 'deep-n2' },
    `${NITROGEN_NOTE.text} `,
    ...NITROGEN_NOTE.sources.flatMap(({ label, doi }, index) => [
      ...(index === 0 ? [] : [' · ']),
      element('a', { href: `https://doi.org/${doi}` }, label),
    ]),
  );
}

const DEEP_AIR_KEY =
  'Shaded: the likely and possible range (CO₂, on a log scale, 100–6,000 ppm), or the range of the methods combined (O₂, 0–45%); dots: single CO₂ estimates; dashed: the 1750 level of CO₂, and today’s O₂.';

export function createDeepAirNote(parts: {
  /** The book that says where the air's numbers come from. */
  readonly why: HTMLElement;
  /** The reader picked the archive's estimates: load it, if not yet. */
  onCo2Archive(): void;
  /** A picker changed: draw the bar again. */
  redraw(): void;
}): DeepAirNote {
  const airNote = element('div', {
    class: 'deep-note air-note',
    hidden: '',
    'data-testid': 'air-note',
  });
  const gasCharts = { co2: createGasChart(), ch4: createGasChart() };
  const deepCharts: DeepCharts = {
    co2: createBandChart({ low: 100, high: 6000, log: true, testId: 'deep-co2-chart' }),
    o2: createBandChart({ low: 0, high: 45, log: false, testId: 'deep-o2-chart' }),
  };
  const co2Dots = createCo2Dots(parts);

  /** On the 540 Myr scale: CO2 and O2 with their ranges, and nitrogen in words. */
  function renderDeepAir(
    deep: DeepAir | null,
    archive: Co2Archive | null,
    oldest: number,
    ma: number,
  ): void {
    if (deep === null) {
      airNote.replaceChildren(parts.why, ' ', element('p', {}, 'Air: loading…'));
      return;
    }
    drawDeepCharts(deepCharts, deep, co2Dots.dots(deep, archive, ma), oldest, ma);
    airNote.replaceChildren(
      parts.why,
      ' ',
      co2Line(deep, ma),
      co2Dots.picker,
      co2Dots.archiveNote,
      deepCharts.co2.root,
      o2Line(deep, ma),
      deepCharts.o2.root,
      nitrogenLine(),
      element('p', {}, DEEP_AIR_KEY),
    );
  }

  /** On the ice-age scale: the gases in Antarctic ice, each with its chart. */
  function renderIceAir(atmosphere: Atmosphere | null, oldest: number, ma: number): void {
    if (atmosphere === null) {
      airNote.replaceChildren(parts.why, ' ', element('p', {}, 'Air: loading…'));
      return;
    }
    const ka = ma * 1000;
    airNote.replaceChildren(
      parts.why,
      ' ',
      ...atmosphere.gases.flatMap((gas) => {
        const chart = gasCharts[gas.id];
        chart.render(gas, oldest * 1000, ka);
        return [
          element(
            'p',
            { 'data-testid': `gas-${gas.id}` },
            `${gasText(gas, ka)} `,
            element('a', { href: `https://doi.org/${gas.doi}` }, gas.credit),
          ),
          chart.root,
        ];
      }),
      element('p', {}, 'Dashed: the 1750 level. From air trapped in Antarctic ice.'),
    );
  }

  return {
    root: airNote,
    render(air, scale, oldest, ma) {
      airNote.hidden = !air.on;
      if (!air.on) return;
      if (scale === 'ice') renderIceAir(air.atmosphere, oldest, ma);
      else renderDeepAir(air.deep, air.archive, oldest, ma);
    },
  };
}
