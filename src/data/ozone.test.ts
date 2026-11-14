import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  capEdgeLatitude,
  holeIn,
  loadOzone,
  ozoneLine,
  ozoneText,
  type OzoneHistory,
} from './ozone';

const file = readFileSync(new URL('../../public/data/ozone/history.json', import.meta.url), 'utf8');
const fetchFile = (): Promise<Response> => Promise.resolve(new Response(file));

async function history(): Promise<OzoneHistory> {
  return loadOzone('history.json', fetchFile);
}

describe('the ozone record', () => {
  it('Given the real file, Then it reads, 1979 to 2025, 1995 missing, the gases from 1992', async () => {
    const ozone = await history();
    expect(ozone.hole.rows[0]?.[0]).toBe(1979);
    expect(ozone.hole.missing).toEqual([1995]);
    expect(ozone.gases.antarctic[0]?.[0]).toBe(1992);
  });

  it('Given years in, missing from and outside the record, Then each says so', async () => {
    const ozone = await history();
    expect(holeIn(ozone, 2006)).toMatchObject({ kind: 'hole', hole: { year: 2006 } });
    expect(holeIn(ozone, 1995)).toEqual({ kind: 'missing', year: 1995 });
    expect(holeIn(ozone, 1900)).toEqual({ kind: 'outside', first: 1979, last: 2025 });
    expect(ozoneText(ozone, 1995)).toMatch(/No satellite measured/);
    expect(ozoneText(ozone, 1900)).toMatch(/runs from 1979 to 2025/);
    expect(ozoneText(ozone, 2006)).toMatch(
      /^The Antarctic ozone hole in the spring of 2006: \d+\.\d million km² on average, its lowest ozone \d+ Dobson units\. Drawn as a cap/,
    );
  });

  it('Given an area, Then the cap of that area round the pole reaches the right latitude', () => {
    expect(capEdgeLatitude(0)).toBe(-90);
    // Earth's surface is about 510 million km²: half of it reaches the equator.
    expect(capEdgeLatitude(255)).toBeCloseTo(0, 0);
    // A hole of 24 million km² reaches about 65°S.
    expect(capEdgeLatitude(24)).toBeCloseTo(-64.6, 0);
    expect(capEdgeLatitude(10_000)).toBe(90);
  });

  it('Given a record with no years, Then every year is outside it', async () => {
    const ozone = await history();
    const empty = { ...ozone, hole: { ...ozone.hole, rows: [] } };
    expect(holeIn(empty, 2000)).toEqual({ kind: 'outside', first: 0, last: 0 });
  });

  it('Given a year, Then a short line for the panel', async () => {
    const ozone = await history();
    expect(ozoneLine(ozone, 2006)).toBe('2006: 26.6 million km², lowest 98 DU.');
    expect(ozoneLine(ozone, 1995)).toBe('1995: not measured.');
    expect(ozoneLine(ozone, 1900)).toBe('No record for 1900.');
  });
});
