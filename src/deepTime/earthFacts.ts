/**
 * Earth's poles, magnetic field, tilt and day at a moment in deep time, as short lines for
 * the deep-time bar. Each says how it is known; uncertain things say so.
 */

import { dayMeasurementsAround, fieldAt, type DayMeasurement, TILT } from './earthState';

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

function field(ma: number): string {
  const { polarity, interval, landRecord } = fieldAt(ma);
  const state = {
    normal: 'Normal polarity, as today: a compass would point north.',
    reversed: 'Reversed polarity: a compass would point south.',
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

export function earthFacts(ma: number): readonly EarthFact[] {
  return [
    {
      label: 'Poles',
      text: 'The globe’s poles are the spin axis then, found from magnetism frozen in rocks. The continents moved beneath them, by plate motion and true polar wander.',
    },
    { label: 'Magnetic field', text: field(ma) },
    {
      label: 'Tilt',
      text: `Between ${String(TILT.min)}° and ${String(TILT.max)}°, cycling every ${(TILT.periodYears / 1000).toFixed(0)},000 years today (faster then, with the Moon nearer); ${String(TILT.today)}° now. Too quick to show here. The Moon keeps it from swinging further (${TILT.source}).`,
    },
    { label: 'Day', text: day(ma) },
  ];
}
