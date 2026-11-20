import { describe, expect, it } from 'vitest';

import type { Layer } from '../../layers/layers';
import { broughtNote, travelTrip } from './travelTrip';

const none = new Set<Layer>();
const both = new Set<Layer>(['empires', 'ways']);

describe('the layers a trip through the years brings (#983)', () => {
  it('Given a first trip, Then it brings borders and ways of life, and says so once', () => {
    const trip = travelTrip();
    expect(trip.open(none)).toEqual({
      bring: ['empires', 'ways'],
      note: 'Travel view turned on States and empires and Ways of life. Turn them off in Layers and they stay off.',
    });
    expect(trip.close()).toEqual(['empires', 'ways']);
    expect(trip.open(none).note).toBeNull();
  });

  it('Given the reader turned one off during the trip, Then the next trip leaves it off', () => {
    const trip = travelTrip();
    trip.open(none);
    trip.seen(both);
    trip.seen(new Set<Layer>(['empires']));
    // Leaving takes only what it brought and the reader left on.
    expect(trip.close()).toEqual(['empires']);
    expect(trip.open(none).bring).toEqual(['empires']);
  });

  it('Given leaving by the Travel view chip, Then the next trip brings them again: that was not the reader turning them off', () => {
    const trip = travelTrip();
    trip.open(none);
    trip.seen(both);
    expect(trip.close()).toEqual(['empires', 'ways']);
    expect(trip.open(none).bring).toEqual(['empires', 'ways']);
  });

  it('Given them on already, or a subject with years of its own, Then nothing is brought or said', () => {
    expect(travelTrip().open(both)).toEqual({ bring: [], note: null });
    expect(travelTrip().open(new Set<Layer>(['enso']))).toEqual({ bring: [], note: null });
  });

  it('Then one layer is told as one', () => {
    expect(broughtNote(['ways'])).toBe(
      'Travel view turned on Ways of life. Turn it off in Layers and it stays off.',
    );
  });
});
