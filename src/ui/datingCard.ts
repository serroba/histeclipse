/**
 * "How was this dated?" (#270): a radiocarbon age carried across the calibration curve to the
 * calendar years it fits, step by step: how much carbon-14 is left, the curve with the measured
 * age across it, and the ranges that hold most of the probability. Examples show the three
 * cases a student meets: a steep stretch (one range), a plateau (centuries) and a wiggle
 * (several ranges); they are illustrations, not real samples. Real eruptions follow (#275): Thera,
 * whose radiocarbon age falls on a plateau and whose date is still disputed, and Changbaishan,
 * dated to its year by a cosmic-ray spike in a tree it killed rather than by calibration.
 *
 * DOM glue, covered by the Playwright suite; the arithmetic is in `data/radiocarbon.ts`.
 */

import {
  calibrate,
  chartWindow,
  fractionLeft,
  highestDensity,
  rangeText,
  yearOfCalBP,
  type CalibrationCurve,
  type CalRange,
} from '../data/radiocarbon';
import { element } from './dom';
import './datingCard.css';

const NS = 'http://www.w3.org/2000/svg';
/** Ranges holding less than this share are left out of the words (they still shade the chart). */
const LISTED_SHARE = 0.005;

const DATING_EXAMPLES = [
  { label: 'On a steep stretch', age: 3500, sigma: 25 },
  { label: 'On the Hallstatt plateau', age: 2450, sigma: 25 },
  { label: 'Where the curve wiggles', age: 1250, sigma: 25 },
] as const;

/** Real eruptions, as their sources report them: a radiocarbon age to calibrate, or a spike. */
const REAL_EXAMPLES: readonly {
  readonly label: string;
  /** A radiocarbon age and its 1σ to calibrate, or null where a spike dates it instead. */
  readonly age: number | null;
  readonly sigma: number;
  readonly note: string;
}[] = [
  {
    label: 'Thera (Santorini), Bronze Age: 3350 ± 10 BP',
    age: 3350,
    sigma: 10,
    note: 'The average of many dates from sites the eruption buried: Akrotiri, on Santorini, and Palaikastro, on Crete. It falls on a plateau of the curve, so it fits several stretches, most likely 1645–1608 BCE as the paper calibrates it. Radiocarbon has long put the eruption 100 to 150 years earlier than the traditional archaeological dating, and the two are still debated; a later stretch, in the 1500s BCE, keeps about a sixth of the probability (van der Plicht et al. 2020, the IntCal20 companion).',
  },
  {
    label: 'Changbaishan, the Millennium Eruption: dated by a spike',
    age: null,
    sigma: 0,
    note: 'A larch engulfed and killed by the eruption’s first pyroclastic flows, on the China–North Korea border, was found in its deposits. Its rings carry the sudden carbon-14 rise of 775 CE, a Miyake event; counting outward from that ring to the bark gives the year the tree died, 946 CE, and ice-core evidence from Greenland puts the eruption late that year (Oppenheimer et al. 2017). No calibration curve is needed: the spike is a fixed point in time.',
  },
];

export interface DatingCard {
  readonly dialog: HTMLDialogElement;
  /** Open it on a curve, named, for a radiocarbon age and its 1σ, with a line on the sample
   * it came from, if any. */
  open(curve: CalibrationCurve, name: string, age?: number, sigma?: number, about?: string): void;
}

function svgElement(name: string, attributes: Record<string, string>): SVGElement {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

function yearWords(calBP: number): string {
  const year = yearOfCalBP(Math.round(calBP));
  return year <= 0 ? `${String(1 - year)} BCE` : `${String(year)} CE`;
}

export function createDatingCard(): DatingCard {
  const ageInput = element('input', {
    type: 'number',
    min: '0',
    max: '50000',
    step: '1',
    class: 'dating-input',
    'aria-label': 'Radiocarbon age, years BP',
  });
  const sigmaInput = element('input', {
    type: 'number',
    min: '1',
    max: '2000',
    step: '1',
    class: 'dating-input',
    'aria-label': 'Give or take, years',
  });
  const left = element('p', { class: 'dating-step', 'data-testid': 'dating-left' });
  const chart = svgElement('svg', {
    class: 'dating-chart',
    viewBox: '0 0 600 260',
    role: 'img',
  }) as SVGSVGElement;
  const ranges = element('ul', { class: 'dating-ranges', 'data-testid': 'dating-ranges' });
  const result = element('p', { class: 'dating-step', 'data-testid': 'dating-result' });
  const note = element('p', { class: 'dating-note', 'data-testid': 'dating-note', hidden: '' });
  const close = element(
    'button',
    { type: 'button', class: 'famous-close', 'aria-label': 'Close' },
    '×',
  );
  const examples = element(
    'div',
    { class: 'dating-examples' },
    ...DATING_EXAMPLES.map(({ label, age, sigma }) => {
      const pick = element(
        'button',
        { type: 'button', class: 'dating-example' },
        `${label}: ${String(age)} ± ${String(sigma)} BP`,
      );
      pick.addEventListener('click', () => {
        ageInput.value = String(age);
        sigmaInput.value = String(sigma);
        note.hidden = true;
        draw();
      });
      return pick;
    }),
  );
  const real = element(
    'div',
    { class: 'dating-examples' },
    ...REAL_EXAMPLES.map((example) => {
      const pick = element('button', { type: 'button', class: 'dating-example' }, example.label);
      pick.addEventListener('click', () => {
        note.hidden = false;
        note.textContent = example.note;
        if (example.age === null) {
          showSpike();
          return;
        }
        ageInput.value = String(example.age);
        sigmaInput.value = String(example.sigma);
        draw();
      });
      return pick;
    }),
  );
  const dialog = element(
    'dialog',
    { class: 'famous-dialog dating-dialog', 'aria-labelledby': 'dating-title' },
    element(
      'header',
      { class: 'famous-header' },
      element('h2', { id: 'dating-title' }, 'How was this dated?'),
      close,
    ),
    element(
      'p',
      { class: 'famous-intro' },
      'A laboratory measures how much carbon-14 a once-living thing has left, as a radiocarbon age in years before 1950 (BP). Carry it across the curve to find the calendar years it fits.',
    ),
    element(
      'div',
      { class: 'dating-form' },
      element('label', {}, 'Radiocarbon age ', ageInput, ' BP'),
      element('label', {}, '± ', sigmaInput, ' years'),
    ),
    element('p', { class: 'dating-examples-label' }, 'Or try (illustrations, not real samples):'),
    examples,
    element('p', { class: 'dating-examples-label' }, 'Real eruptions:'),
    real,
    note,
    left,
    chart,
    result,
    ranges,
  );
  let curve: CalibrationCurve | null = null;
  let curveName = '';

  /** A date fixed by a spike, not calibrated: the steps say so, and the chart and ranges rest. */
  function showSpike(): void {
    left.textContent =
      '1. No radiocarbon age to calibrate: the tree’s rings themselves are counted, from the ring that holds the 775 CE spike.';
    result.textContent = '2. The tree died in 946 CE, to the year.';
    chart.replaceChildren();
    chart.setAttribute('aria-label', 'No calibration: dated by counting rings from a spike.');
    ranges.replaceChildren();
  }

  function draw(): void {
    const age = Number(ageInput.value);
    const sigma = Number(sigmaInput.value);
    if (curve === null || !(age > 0) || !(sigma > 0)) return;
    const percent = Math.round(fractionLeft(age) * 1000) / 10;
    left.textContent = `1. ${String(percent)}% of the carbon-14 it took in while alive is left: ${String(age)} ± ${String(sigma)} radiocarbon years.`;
    const calibration = calibrate(age, sigma, curve);
    const found = highestDensity(calibration);
    drawChart(curve, age, sigma, calibration.calBP, calibration.probability, found);
    const listed = found.filter(({ share }) => share >= LISTED_SHARE);
    result.textContent =
      listed.length === 1
        ? `2. Across the curve (${curveName}) it fits one stretch of years, with 95% probability:`
        : `2. Across the curve (${curveName}) it fits ${String(listed.length)} stretches of years, 95% probability between them:`;
    ranges.replaceChildren(
      ...listed.map((range) =>
        element(
          'li',
          {},
          element('strong', {}, rangeText(range)),
          ` ${String(Math.round(range.share * 100))}%`,
        ),
      ),
    );
    chart.setAttribute(
      'aria-label',
      `The calibration curve with ${String(age)} ± ${String(sigma)} BP across it; it fits ${listed
        .map(rangeText)
        .join(', ')}.`,
    );
  }

  function drawChart(
    shown: CalibrationCurve,
    age: number,
    sigma: number,
    calBP: readonly number[],
    probability: readonly number[],
    found: readonly CalRange[],
  ): void {
    const { older, younger } = chartWindow(found);
    const rows = shown.calBP
      .map((at, i) => ({ at, mu: shown.age[i] ?? 0, s: shown.sigma[i] ?? 0 }))
      .filter(({ at }) => at >= younger && at <= older);
    const lowAge = Math.min(age - 3 * sigma, ...rows.map(({ mu, s }) => mu - s));
    const highAge = Math.max(age + 3 * sigma, ...rows.map(({ mu, s }) => mu + s));
    // Calendar years run left (older) to right; radiocarbon age runs up. The top 190 units are
    // the curve, the bottom 60 the probability.
    const x = (at: number): number => 64 + ((older - at) / (older - younger || 1)) * 526;
    const y = (value: number): number => 10 + ((highAge - value) / (highAge - lowAge || 1)) * 170;
    const band = [
      ...rows.map(({ at, mu, s }) => `${x(at).toFixed(1)},${y(mu + s).toFixed(1)}`),
      ...rows
        .slice()
        .reverse()
        .map(({ at, mu, s }) => `${x(at).toFixed(1)},${y(mu - s).toFixed(1)}`),
    ].join(' ');
    const inWindow = calBP
      .map((at, i) => ({ at, p: probability[i] ?? 0 }))
      .filter(({ at }) => at >= younger && at <= older);
    const peak = Math.max(...inWindow.map(({ p }) => p)) || 1;
    const density = [
      `${x(older).toFixed(1)},250`,
      ...inWindow
        .slice()
        .reverse()
        .map(({ at, p }) => `${x(at).toFixed(1)},${(250 - (p / peak) * 55).toFixed(1)}`),
      `${x(younger).toFixed(1)},250`,
    ].join(' ');
    chart.replaceChildren(
      // The measured age, give or take, across the chart.
      svgElement('rect', {
        class: 'dating-measured',
        x: '64',
        width: '526',
        y: y(age + sigma).toFixed(1),
        height: Math.max(1, y(age - sigma) - y(age + sigma)).toFixed(1),
      }),
      svgElement('polygon', { class: 'dating-curve', points: band }),
      ...found.map((range) =>
        svgElement('rect', {
          class: 'dating-range',
          x: x(range.older).toFixed(1),
          width: Math.max(1, x(range.younger) - x(range.older)).toFixed(1),
          y: '190',
          height: '60',
        }),
      ),
      svgElement('polygon', { class: 'dating-density', points: density }),
      ...[older, (older + younger) / 2, younger].map((at, i) => {
        const text = svgElement('text', {
          class: 'dating-axis',
          x: x(at).toFixed(1),
          y: '258',
          'text-anchor': i === 0 ? 'start' : i === 2 ? 'end' : 'middle',
        });
        text.textContent = yearWords(at);
        return text;
      }),
      Object.assign(
        svgElement('text', { class: 'dating-axis', x: '60', y: '16', 'text-anchor': 'end' }),
        {
          textContent: `${String(Math.round(highAge))} BP`,
        },
      ),
      Object.assign(
        svgElement('text', { class: 'dating-axis', x: '60', y: '182', 'text-anchor': 'end' }),
        {
          textContent: `${String(Math.round(lowAge))} BP`,
        },
      ),
    );
  }

  for (const input of [ageInput, sigmaInput]) {
    input.addEventListener('change', () => {
      // An age typed in is the reader's own, not the example's.
      note.hidden = true;
      draw();
    });
  }
  close.addEventListener('click', () => {
    dialog.close();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  return {
    dialog,
    open(next, name, age = 2450, sigma = 25, about) {
      curve = next;
      curveName = name;
      ageInput.value = String(age);
      sigmaInput.value = String(sigma);
      note.hidden = about === undefined;
      note.textContent = about ?? '';
      dialog.showModal();
      draw();
    },
  };
}
