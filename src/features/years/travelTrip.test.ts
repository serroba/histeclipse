import { describe, expect, it, vi } from 'vitest';

import type { Layer } from '../../layers/layers';
import { broughtNote, FIRST_FARMERS, travelTrip, tripTurn } from './travelTrip';

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

describe('the globe’s turn as a trip starts (#984)', () => {
  it('Given the first trip from the Holocene’s start, Then it turns to the first farmers, once', () => {
    const flyTo = vi.fn();
    const turn = tripTurn({ flyTo });
    turn.start(true);
    turn.start(true);
    expect(flyTo).toHaveBeenCalledExactlyOnceWith(FIRST_FARMERS);
  });

  it('Given a trip from elsewhere (mid-way, or El Niño’s years), Then the camera is left be', () => {
    const flyTo = vi.fn();
    const turn = tripTurn({ flyTo });
    turn.start(false);
    expect(flyTo).not.toHaveBeenCalled();
    turn.start(true);
    expect(flyTo).toHaveBeenCalledOnce();
  });
});
