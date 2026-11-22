import { describe, expect, it } from 'vitest';

import { DAY_EVENTS, dayEventsIn } from './dayEvents';

describe('single days on the years bar (#837)', () => {
  it('Given 2015, Then GW150914 is its event, and opens the wave on its day', () => {
    const [wave, ...more] = dayEventsIn(2015);
    expect(more).toEqual([]);
    expect(wave?.label).toBe('GW150914: first gravitational wave');
    expect([wave?.month, wave?.day]).toEqual([9, 14]);
    const view = new URLSearchParams(wave?.anchor.view);
    expect(view.get('wave')).toBe('gw150914');
    expect(view.get('t')).toBe('2015-09-14T09:50Z');
    expect(view.get('explore')).toBe('gravitational-waves');
  });

  it('Given a year with none, Then there are none', () => {
    expect(dayEventsIn(2014)).toEqual([]);
    expect(dayEventsIn(2016)).toEqual([]);
  });

  it('Given the registry, Then each event names a destination there is', () => {
    expect(DAY_EVENTS.map(({ label }) => label.split(':')[0])).toEqual(['GW150914', 'GW170817']);
  });

  it("Given every event, Then its view's moment falls on its own day", () => {
    for (const event of DAY_EVENTS) {
      const t = new URLSearchParams(event.anchor.view).get('t') ?? '';
      const day = `${String(event.year)}-${String(event.month).padStart(2, '0')}-${String(event.day).padStart(2, '0')}`;
      expect(t.startsWith(day), `${event.label}: ${t}`).toBe(true);
    }
  });
});
