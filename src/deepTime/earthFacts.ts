/**
 * Earth's poles, magnetic field, tilt, day and Sun at a moment in deep time, as short lines for
 * the deep-time bar. Each says how it is known; uncertain things say so.
 */

import { chronAt, type PolarityScale } from '../data/polarity';
import { dayMeasurementsAround, fieldAt, type DayMeasurement, TILT } from './earthState';
import { polarWanderAt } from './polarWander';
import { sunBrightness } from './sketch';

export interface EarthFact {
  readonly label: string;
  readonly text: string;
}

function hours({ hours, uncertainty }: DayMeasurement): string {
  return uncertainty === null
    ? `${hours.toFixed(1)} h`
    : `${hours.toFixed(1)} ± ${uncertainty.toFixed(1)} h`;
}

function measured(measurement: DayMeasurement): string {
  if (measurement.ma === 0) return `${hours(measurement)} today`;
  return `${hours(measurement)} ${String(measurement.ma)} Ma, from ${measurement.evidence} (${measurement.source})`;
}

const POLES =
  'The globe’s poles are the spin axis then, found from magnetism frozen in rocks: the poles stay put and the continents moved beneath them, by plate motion and true polar wander (the whole Earth turning beneath its spin axis). Magnetic north is marked at the pole a compass pointed to; it swapped at each reversal, drawn under the slider.';

/** The poles, and the true polar wander under way then, with who found it and who doubts it. */
function poles(ma: number): string {
  const episode = polarWanderAt(ma);
  if (episode === null) return POLES;
  return `${POLES} True polar wander then, the ${episode.name}: ${episode.found} ${episode.questioned}`;
}

/** Before this, the reversal record is too sparse to say what the field was doing. */
const SPARSE_FIELD_MA = 540;

function field(ma: number, scale: PolarityScale | null): string {
  if (ma > SPARSE_FIELD_MA) {
    return 'Too far back to say which way it pointed: the record is sparse. A magnetic field existed by 3.45–3.4 billion years ago (Tarduno et al. 2010); one recorded in 4.2-billion-year-old zircons (Tarduno et al. 2015) has been questioned (Weiss et al. 2018).';
  }
  const { polarity, interval, landRecord } = fieldAt(ma, scale);
  const chron = scale === null ? null : chronAt(scale, ma);
  const named = chron === null ? '' : ` (chron ${chron}, GTS 2020)`;
  const state = {
    normal: `Normal polarity, as today${named}: a compass would point north.`,
    reversed: `Reversed polarity${named}: a compass would point south.`,
    mixed:
      'Reversing often: north and south swapped every few hundred thousand years, so either way round at this moment.',
  }[polarity];
  const parts = [state];
  if (interval !== null) parts.push(`${interval.name}. ${interval.note}`);
  if (landRecord) parts.push('Known from rocks on land only: older sea floor is gone.');
  parts.push(
    'At any moment the magnetic poles wander 10–20° from the spin axis; where exactly cannot be known.',
  );
  return parts.join(' ');
}

function day(ma: number): string {
  const { younger, older } = dayMeasurementsAround(ma);
  if (younger.ma === ma) return `${measured(younger)}.`;
  if (older === null) return `Shorter than ${hours(younger)}: ${measured(younger)}.`;
  return `Measured ${measured(younger)}, and ${measured(older)}.`;
}

/** Before this, today's air under that Sun would have frozen the ocean: the faint young Sun paradox. */
const FAINT_SUN_MA = 2500;

function sun(ma: number): string {
  const brightness = `About ${(sunBrightness(ma) * 100).toFixed(0)}% as bright as today (Gough 1981): the Sun brightens as it ages.`;
  if (ma <= FAINT_SUN_MA) return brightness;
  return `${brightness} With today’s air the ocean would have frozen, yet there is evidence of liquid water: the faint young Sun paradox (Sagan & Mullen 1972). Stronger greenhouse gases are the usual answer; how much of which is argued over.`;
}

/** The Precambrian tilt is argued over. */
const PRECAMBRIAN_TILT =
  'A much larger tilt has been proposed for these times (Williams 1993) and argued to be unlikely (Néron de Surgy & Laskar 1997). Today: ';

export function earthFacts(ma: number, scale: PolarityScale | null = null): readonly EarthFact[] {
  return [
    {
      label: 'Poles',
      text: poles(ma),
    },
    { label: 'Magnetic field', text: field(ma, scale) },
    {
      label: 'Tilt',
      text: `${ma > SPARSE_FIELD_MA ? PRECAMBRIAN_TILT : ''}Between ${String(TILT.min)}° and ${String(TILT.max)}°, cycling every ${(TILT.periodYears / 1000).toFixed(0)},000 years today (faster then, with the Moon nearer); ${String(TILT.today)}° now. Too quick to show here. The Moon keeps it from swinging further (${TILT.source}).`,
    },
    { label: 'Day', text: day(ma) },
    { label: 'Sun', text: sun(ma) },
  ];
}
