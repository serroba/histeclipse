/**
 * "How is carbon-14 made?" (#269): cosmic rays making carbon-14 in the air, how much at each
 * latitude for a magnetic field and a Sun the reader picks, and the path from the air into
 * living things, to the limit of the clock. The globe's glow follows the choice.
 *
 * DOM glue, covered by the Playwright suite; the rates are in `data/radiocarbonProduction.ts`.
 */

import {
  DATABLE_YEARS,
  FIELD_CHOICES,
  globalFor,
  HALF_LIFE,
  profileFor,
  SUN_CHOICES,
  type FieldChoice,
  type SunChoice,
} from '../../data/radiocarbonProduction';
import { elementAt } from '../../util/arrays';
import { element } from '../../ui/dom';
import '../../ui/datingCard.css';
import './carbonMadeCard.css';

const NS = 'http://www.w3.org/2000/svg';
/** Latitude step of the chart and the glow, degrees. */
const STEP = 5;

export interface CarbonMade {
  readonly field: FieldChoice;
  readonly sun: SunChoice;
  /** Atoms per cm² per second, every 5° from the equator to the pole. */
  readonly profile: readonly number[];
}

/** Today's field and an average solar cycle: what the chart compares with. */
const TODAY_FIELD = elementAt(FIELD_CHOICES, 0);
const TODAY_SUN = elementAt(SUN_CHOICES, 0);
const TODAY = profileFor(TODAY_FIELD, TODAY_SUN, STEP);

/** The glow for what is made: each latitude's rate, 1 for today's over the poles. */
export function glowOf(made: CarbonMade): readonly number[] {
  const pole = TODAY.at(-1) ?? 1;
  return made.profile.map((value) => value / pole);
}

/** The field at the moment shown, as the card offers it first; its dipole is set by `setThen`. */
export const THEN_ID = 'then';
export const THEN_UNKNOWN: FieldChoice = {
  id: THEN_ID,
  label: 'At the moment shown',
  dipole: TODAY_FIELD.dipole,
  note: 'The field at the moment shown is not known here: today’s is drawn.',
};

/** The field at the moment shown, with what to say of it, for a dipole of `dipole` ×10²² A m². */
export function thenField(dipole: number): FieldChoice {
  const weak =
    dipole < 4
      ? ' A smooth model: those fitted to the Laschamp excursion put its low far lower, under 0.4 (Korte et al. 2019).'
      : '';
  return {
    id: THEN_ID,
    label: 'At the moment shown',
    dipole,
    note: `GGF100k puts the dipole at ${dipole.toFixed(1)} × 10²² A m² then (Panovska et al. 2018; today’s is 7.8).${weak}`,
  };
}

export interface CarbonMadeCard {
  readonly dialog: HTMLDialogElement;
  /** The field and Sun picked, and what they make. */
  current(): CarbonMade;
  /** The field at the moment shown, or null where it is not known (today's stands in). */
  setThen(field: FieldChoice | null): void;
  open(): void;
}

function svgElement(name: string, attributes: Record<string, string>): SVGElement {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

function svgText(text: string, attributes: Record<string, string>): SVGElement {
  const node = svgElement('text', attributes);
  node.textContent = text;
  return node;
}

/** A number as a reader says it: one decimal under 10, whole above. */
function rate(value: number): string {
  return value < 10 ? value.toFixed(1) : String(Math.round(value));
}

function picker<T extends { readonly id: string; readonly label: string }>(
  legend: string,
  name: string,
  choices: readonly T[],
  onPick: () => void,
): { readonly root: HTMLFieldSetElement; chosen(): T } {
  const inputs = choices.map((choice, i) => {
    const input = element('input', { type: 'radio', name, value: choice.id });
    input.checked = i === 0;
    input.addEventListener('change', onPick);
    return input;
  });
  const root = element(
    'fieldset',
    { class: 'carbon-made-picker' },
    element('legend', {}, legend),
    ...choices.map((choice, i) =>
      element('label', { class: 'carbon-made-choice' }, inputs[i] ?? '', ` ${choice.label}`),
    ),
  );
  return {
    root,
    chosen() {
      const i = inputs.findIndex((input) => input.checked);
      return elementAt(choices, Math.max(0, i));
    },
  };
}

export function createCarbonMadeCard(
  onChange: (made: CarbonMade) => void,
  /** Play the shower; `fromSun` starts the story at the Sun's core. */
  onWatch: (made: CarbonMade, fromSun: boolean) => void,
): CarbonMadeCard {
  const watch = element(
    'button',
    { type: 'button', class: 'dating-example carbon-made-watch' },
    'Watch a cosmic ray make carbon-14',
  );
  const fromSun = element(
    'button',
    { type: 'button', class: 'dating-example carbon-made-watch' },
    'Start from the Sun',
  );
  const close = element(
    'button',
    { type: 'button', class: 'famous-close', 'aria-label': 'Close' },
    '×',
  );
  const field = picker(
    'Earth’s magnetic field',
    'carbon-made-field',
    [THEN_UNKNOWN, ...FIELD_CHOICES],
    draw,
  );
  let then: FieldChoice | null = null;
  const sun = picker('The Sun', 'carbon-made-sun', SUN_CHOICES, draw);
  const notes = element('p', { class: 'carbon-made-notes', 'data-testid': 'carbon-made-notes' });
  const chart = svgElement('svg', {
    class: 'carbon-made-chart',
    viewBox: '0 0 600 240',
    role: 'img',
  }) as SVGSVGElement;
  const result = element('p', { class: 'dating-step', 'data-testid': 'carbon-made-result' });
  const dialog = element(
    'dialog',
    { class: 'famous-dialog carbon-made-dialog', 'aria-labelledby': 'carbon-made-title' },
    element(
      'header',
      { class: 'famous-header' },
      element('h2', { id: 'carbon-made-title' }, 'How is carbon-14 made?'),
      close,
    ),
    element(
      'p',
      { class: 'famous-intro' },
      'Cosmic rays, fast nuclei from far beyond the Sun, strike the air high up. Their showers set neutrons loose, and a neutron that hits nitrogen-14 turns it into carbon-14: n + ¹⁴N → ¹⁴C + p.',
    ),
    element(
      'p',
      { class: 'dating-step' },
      'Earth’s magnetic field turns the slower rays away, least near the poles, where its lines run into the ground. The Sun’s wind turns some away too, more when the Sun is active. Pick a field and a Sun; the globe glows to match.',
    ),
    element('div', { class: 'carbon-made-watches' }, watch, fromSun),
    element('div', { class: 'carbon-made-pickers' }, field.root, sun.root),
    notes,
    chart,
    result,
    element('h3', { class: 'carbon-made-heading' }, 'From the air into living things'),
    element(
      'ol',
      { class: 'carbon-made-path', 'data-testid': 'carbon-made-path' },
      element(
        'li',
        {},
        'Carbon-14 joins oxygen as carbon dioxide and mixes through the air within a few years.',
      ),
      element(
        'li',
        {},
        'Plants take it in as they grow; animals and people eat the plants. While alive, each holds about the air’s share of carbon-14.',
      ),
      element(
        'li',
        {},
        'The ocean takes it in slowly and holds it for centuries, so a sea shell reads about 400–600 radiocarbon years older than a plant of the same year (Marine20 against IntCal20, the last 11,000 years).',
      ),
      element(
        'li',
        {},
        `At death the intake stops and the clock starts: half the carbon-14 is gone every ${HALF_LIFE.toLocaleString('en')} years.`,
      ),
      element(
        'li',
        {},
        `After about ${DATABLE_YEARS.toLocaleString('en')} years too little is left to measure: older things are dated by other clocks, such as potassium–argon and uranium–lead.`,
      ),
    ),
  );

  const today = TODAY;
  const todayGlobal = globalFor(TODAY_FIELD, TODAY_SUN);
  let made: CarbonMade = { field: THEN_UNKNOWN, sun: sun.chosen(), profile: today };

  /** The field picked: the moment's, where it is known, or a fixed one. */
  function pickedField(): FieldChoice {
    const chosen = field.chosen();
    return chosen.id === THEN_ID ? (then ?? THEN_UNKNOWN) : chosen;
  }

  /** Work out what the field and Sun picked make, without drawing. */
  function reckon(): CarbonMade {
    const chosenField = pickedField();
    const chosenSun = sun.chosen();
    made = {
      field: chosenField,
      sun: chosenSun,
      profile: profileFor(chosenField, chosenSun, STEP),
    };
    return made;
  }

  function draw(): void {
    const { field: chosenField, sun: chosenSun, profile } = reckon();
    notes.textContent = `${chosenField.note} ${chosenSun.note}`;
    const global = globalFor(chosenField, chosenSun);
    const equator = profile[0] ?? 0;
    const pole = profile.at(-1) ?? 0;
    const times = global / todayGlobal;
    const compared =
      Math.abs(times - 1) < 0.005 ? '' : `, ${times.toFixed(1)} times today’s average`;
    const poles =
      pole / equator < 1.05
        ? 'With no shield, as much over the equator as over the poles.'
        : `${rate(pole / equator)} times as much over the poles as over the equator.`;
    result.textContent = `Averaged over the globe: ${rate(global)} atoms of carbon-14 on each square centimetre every second${compared}. ${poles}`;
    drawChart(profile);
    onChange(made);
  }

  function drawChart(profile: readonly number[]): void {
    const top = Math.max(4, ...profile, ...today) * 1.05;
    // Latitude runs left (equator) to right (pole); the rate runs up.
    const x = (i: number): number => 64 + ((i * STEP) / 90) * 516;
    const y = (value: number): number => 16 + (1 - value / top) * 184;
    const line = (values: readonly number[]): string =>
      values.map((value, i) => `${x(i).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
    const ticks = [0, Math.round(top / 2), Math.floor(top)];
    chart.replaceChildren(
      ...ticks.map((value) =>
        svgElement('line', {
          class: 'carbon-made-grid',
          x1: '64',
          x2: '580',
          y1: y(value).toFixed(1),
          y2: y(value).toFixed(1),
        }),
      ),
      ...ticks.map((value) =>
        svgText(String(value), {
          class: 'dating-axis',
          x: '58',
          y: (y(value) + 4).toFixed(1),
          'text-anchor': 'end',
        }),
      ),
      svgElement('polyline', { class: 'carbon-made-today', points: line(today) }),
      svgElement('polyline', { class: 'carbon-made-line', points: line(profile) }),
      ...[0, 30, 60, 90].map((latitude) =>
        svgText(latitude === 0 ? 'Equator' : latitude === 90 ? 'Pole' : `${String(latitude)}°`, {
          class: 'dating-axis',
          x: x(latitude / STEP).toFixed(1),
          y: '220',
          'text-anchor': latitude === 0 ? 'start' : latitude === 90 ? 'end' : 'middle',
        }),
      ),
      svgText('Magnetic latitude', {
        class: 'dating-axis',
        x: '322',
        y: '236',
        'text-anchor': 'middle',
      }),
      svgText('Atoms per cm² per second', { class: 'dating-axis', x: '64', y: '10' }),
      svgElement('line', { class: 'carbon-made-line', x1: '360', x2: '384', y1: '8', y2: '8' }),
      svgText('Picked', { class: 'dating-axis', x: '390', y: '12' }),
      svgElement('line', { class: 'carbon-made-today', x1: '450', x2: '474', y1: '8', y2: '8' }),
      svgText('Today', { class: 'dating-axis', x: '480', y: '12' }),
    );
    chart.setAttribute(
      'aria-label',
      `Carbon-14 made by latitude: ${rate(profile[0] ?? 0)} at the equator, ${rate(profile[9] ?? 0)} at 45°, ${rate(profile.at(-1) ?? 0)} at the poles, atoms per cm² per second; today’s is ${rate(today[0] ?? 0)}, ${rate(today[9] ?? 0)} and ${rate(today.at(-1) ?? 0)}.`,
    );
  }

  close.addEventListener('click', () => {
    dialog.close();
  });
  watch.addEventListener('click', () => {
    dialog.close();
    onWatch(made, false);
  });
  fromSun.addEventListener('click', () => {
    dialog.close();
    onWatch(made, true);
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  return {
    dialog,
    current: () => made,
    setThen(next) {
      // Drawing tells the app, which sets the moment's field again: the same one changes nothing.
      if (next?.dipole === then?.dipole && next?.note === then?.note) return;
      then = next;
      if (field.chosen().id !== THEN_ID) return;
      if (dialog.open) draw();
      else reckon();
    },
    open() {
      dialog.showModal();
      draw();
    },
  };
}
