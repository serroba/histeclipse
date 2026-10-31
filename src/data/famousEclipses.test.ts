import { describe, expect, it } from 'vitest';

import { eclipseMoment, isSolar } from '../eclipses/describe';
import { solarOutlook } from '../eclipses/solar';
import { moonVisibility } from '../eclipses/visibility';
import { defaultCalendarFor } from '../state/viewState';
import { DeltaT } from '../time/deltaT';
import { elementAt } from '../util/arrays';
import { calendarDateOf, julianDay } from '../time/julianDay';
import { astronomicalYear } from '../time/year';
import type { Fetch } from './catalog';
import { greatestEclipseUT } from './catalog';
import {
  famousDate,
  famousDateParts,
  famousFor,
  loadFamousEclipses,
  type FamousEclipse,
} from './famousEclipses';
import { LunarCatalog, type LunarEclipse } from './lunarCatalog';
import { SolarCatalog, type SolarEclipse } from './solarCatalog';

const files = import.meta.glob<unknown>('../../public/data/**/*.json', {
  eager: true,
  import: 'default',
});
const served = new Map(
  Object.entries(files).map(([path, json]) => [path.replace('../../public', ''), json]),
);
const fetchServed: Fetch = (url) => {
  const body = served.get(url);
  return Promise.resolve(
    body === undefined ? new Response(null, { status: 404 }) : Response.json(body),
  );
};

const famous = await loadFamousEclipses('/data/famous-eclipses.json', fetchServed);
const lunar = await LunarCatalog.load('/data/lunar/', fetchServed);
const solar = await SolarCatalog.load('/data/solar/', fetchServed);
const deltaT = new DeltaT(served.get('/data/delta-t.json'));

async function catalogEclipse(
  entry: FamousEclipse,
): Promise<LunarEclipse | SolarEclipse | undefined> {
  const [year, month, day] = famousDateParts(entry);
  const target = julianDay(
    calendarDateOf(astronomicalYear(year), month, day, defaultCalendarFor(year, month, day)),
  );
  const catalog = entry.kind === 'solar' ? solar : lunar;
  const eclipses: readonly (LunarEclipse | SolarEclipse)[] = await catalog.eclipsesInYear(
    astronomicalYear(year),
  );
  return eclipses.find((eclipse) => {
    const { date } = eclipseMoment(eclipse);
    return Math.floor(julianDay(date) + 0.5) === Math.floor(target + 0.5);
  });
}

function computedSeen(
  eclipse: LunarEclipse | SolarEclipse,
  place: { latitude: number; longitude: number },
): string {
  const uncertainty = deltaT.uncertaintySeconds(greatestEclipseUT(eclipse));
  if (isSolar(eclipse)) {
    const { phases } = solarOutlook(eclipse.elements, eclipse.deltaT, uncertainty, place);
    return phases.length === 1 ? (phases[0] ?? 'none') : 'uncertain';
  }
  const [latitude, longitude] = eclipse.sublunar;
  return moonVisibility({ latitude, longitude }, place, uncertainty);
}

describe('famous eclipses', () => {
  it('has well-formed, unique entries in date order', () => {
    expect(famous.length).toBeGreaterThanOrEqual(15);
    const order = famous.map((entry) => {
      const [year, month, day] = famousDateParts(entry);
      return julianDay(
        calendarDateOf(astronomicalYear(year), month, day, defaultCalendarFor(year, month, day)),
      );
    });
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it.each(famous.map((entry) => [entry.id, entry] as const))(
    '%s is a real eclipse of that kind on that date, seen as stated',
    async (_id, entry) => {
      const eclipse = await catalogEclipse(entry);
      expect(eclipse, `no ${entry.kind} eclipse on ${entry.date}`).toBeDefined();
      if (eclipse === undefined || entry.place === undefined) return;
      expect(computedSeen(eclipse, entry.place)).toBe(entry.seen);
    },
  );
});

describe('famous eclipse data rules', () => {
  const valid = served.get('/data/famous-eclipses.json') as { eclipses: object[] };
  const load = (document: unknown) =>
    loadFamousEclipses('/x.json', () => Promise.resolve(Response.json(document)));

  it('rejects duplicate ids', async () => {
    const [first] = valid.eclipses;
    await expect(load({ ...valid, eclipses: [first, first] })).rejects.toThrow(/unique/);
  });

  it('requires a note on debated entries and a place with every outcome', async () => {
    // The Assyrian eclipse: not debated, with a place.
    const assyria = elementAt(valid.eclipses, 1);
    await expect(load({ ...valid, eclipses: [{ ...assyria, debated: true }] })).rejects.toThrow(
      /debateNote/,
    );
    await expect(load({ ...valid, eclipses: [{ ...assyria, place: undefined }] })).rejects.toThrow(
      /go together/,
    );
  });
});

describe('famousDateParts', () => {
  it('splits astronomical dates', () => {
    expect(famousDateParts({ ...elementAt(famous, 0), date: '-762-06-15' })).toEqual([-762, 6, 15]);
  });

  it('rejects malformed dates', () => {
    expect(() => famousDateParts({ ...elementAt(famous, 0), date: 'June 763 BCE' })).toThrow(
      RangeError,
    );
  });
});

describe('famousFor', () => {
  it('finds the entry for a selection, whatever calendar its date is in', () => {
    const syracuse = famous.find((entry) => entry.id === 'syracuse-413-bce');
    expect(famousFor(famous, { kind: 'lunar', date: famousDate(elementAt(famous, 6)) })).toBe(
      syracuse,
    );
    // The same day, written in the proleptic Gregorian calendar.
    const gregorian = calendarDateOf(astronomicalYear(-412), 8, 22, 'gregorian');
    expect(famousFor(famous, { kind: 'lunar', date: gregorian })).toBe(syracuse);
  });

  it('needs the kind to match too, and a selection', () => {
    expect(
      famousFor(famous, { kind: 'solar', date: famousDate(elementAt(famous, 6)) }),
    ).toBeUndefined();
    expect(famousFor(famous, null)).toBeUndefined();
  });
});
