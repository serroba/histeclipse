/**
 * Carbon dioxide and methane over the last 800,000 years (`public/data/atmosphere.json`), from
 * Antarctic ice cores via NOAA's World Data Center for Paleoclimatology, by the pipeline's
 * `atmosphere` command: each measurement's gas age (thousands of years before 1950), value and
 * 1σ, with each gas's pre-industrial level (1750, IPCC AR6) to compare against.
 */

import * as v from 'valibot';

import { elementAt } from '../util/arrays';
import { getJson, type Fetch } from './fetchJson';

const GasSchema = v.strictObject({
  id: v.picklist(['co2', 'ch4']),
  name: v.pipe(v.string(), v.minLength(1)),
  unit: v.picklist(['ppm', 'ppb']),
  credit: v.pipe(v.string(), v.minLength(1)),
  doi: v.pipe(v.string(), v.regex(/^10\.\d{4,9}\/\S+$/)),
  preindustrial: v.pipe(v.number(), v.gtValue(0)),
  /** Each: thousands of years ago, value, 1σ; youngest first. */
  points: v.pipe(
    v.array(
      v.tuple([v.number(), v.pipe(v.number(), v.gtValue(0)), v.pipe(v.number(), v.minValue(0))]),
    ),
    v.minLength(2),
    v.check(
      (points) =>
        points.every((point, index) => index === 0 || point[0] >= (points[index - 1]?.[0] ?? 0)),
      'points run from the present back in time',
    ),
  ),
});

const AtmosphereSchema = v.strictObject({
  schemaVersion: v.literal(1),
  source: v.pipe(v.string(), v.url()),
  gases: v.array(GasSchema),
});

export type Atmosphere = v.InferOutput<typeof AtmosphereSchema>;
export type Gas = v.InferOutput<typeof GasSchema>;

export async function loadAtmosphere(url: string, fetchJson: Fetch): Promise<Atmosphere> {
  return getJson(fetchJson, url, AtmosphereSchema);
}

/** The oldest moment a gas's record reaches, thousands of years ago. */
export function oldestKa(gas: Gas): number {
  return elementAt(gas.points, gas.points.length - 1)[0];
}

/**
 * A gas `ka` thousand years ago, between the measurements either side, with the larger of
 * their 1σ; null beyond its record.
 */
export function gasAt(
  gas: Gas,
  ka: number,
): { readonly value: number; readonly sigma: number } | null {
  const { points } = gas;
  const after = points.findIndex((point) => point[0] >= ka);
  if (after <= 0)
    return after === 0 ? { value: elementAt(points, 0)[1], sigma: elementAt(points, 0)[2] } : null;
  const [olderKa, olderValue, olderSigma] = elementAt(points, after);
  const [youngerKa, youngerValue, youngerSigma] = elementAt(points, after - 1);
  const share = (ka - youngerKa) / (olderKa - youngerKa);
  return {
    value: youngerValue + share * (olderValue - youngerValue),
    sigma: Math.max(youngerSigma, olderSigma),
  };
}

/** What the bar says of a gas at a moment: its level and how it compares with 1750. */
export function gasText(gas: Gas, ka: number): string {
  const at = gasAt(gas, ka);
  const name = `${gas.name} (${gas.unit === 'ppm' ? 'CO₂' : 'CH₄'})`;
  if (at === null) {
    return `${name}: the ice cores reach ${Math.round(oldestKa(gas) * 1000).toLocaleString('en')} years back, not this far.`;
  }
  const share = Math.round((at.value / gas.preindustrial) * 100);
  return `${name}: ${String(Math.round(at.value))} ${gas.unit} (±${String(Math.max(1, Math.round(at.sigma)))}), ${String(share)}% of the 1750 level (${String(gas.preindustrial)} ${gas.unit}).`;
}
