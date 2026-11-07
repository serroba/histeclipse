import { afterEach, describe, expect, it, vi } from 'vitest';

import { browserTimeZone, leavesViewOpen, placeOfZone, type TimeZones } from './timezones';

const data: TimeZones = {
  schemaVersion: 1,
  credit: 'The tz database (IANA)',
  source: 'https://data.iana.org/time-zones/tzdb/',
  accessed: '2026-11-07',
  zones: { 'Australia/Sydney': [-33.9, 151.2], 'Asia/Calcutta': [22.5, 88.4] },
};

describe('the time zone’s place', () => {
  it('gives the place of a known zone or alias', () => {
    expect(placeOfZone(data, 'Australia/Sydney')).toEqual({ latitude: -33.9, longitude: 151.2 });
    expect(placeOfZone(data, 'Asia/Calcutta')).toEqual({ latitude: 22.5, longitude: 88.4 });
  });

  it('gives none for a zone with no place, or an unknown one', () => {
    expect(placeOfZone(data, 'UTC')).toBeNull();
    expect(placeOfZone(data, 'Mars/Olympus')).toBeNull();
  });

  it('leaves the first view to the reader only when the link names none of its own', () => {
    expect(leavesViewOpen('')).toBe(true);
    expect(leavesViewOpen('?t=2024-04-08T18:17&layers=lunar,solar')).toBe(true);
    for (const own of [
      'cam=0,0,3',
      'focus=sun',
      'view=sky',
      'sel=solar:2024-04-08',
      'ma=66',
      'loc=1,2',
    ]) {
      expect(leavesViewOpen(`?${own}`)).toBe(false);
    }
  });
});

describe('the browser’s time zone', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the zone the browser reports', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'Australia/Sydney' }),
    } as Intl.DateTimeFormat);
    expect(browserTimeZone()).toBe('Australia/Sydney');
  });

  it('gives none where the browser reports none, or cannot say', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: '' }),
    } as Intl.DateTimeFormat);
    expect(browserTimeZone()).toBeNull();
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new RangeError('no time zones here');
    });
    expect(browserTimeZone()).toBeNull();
  });
});
