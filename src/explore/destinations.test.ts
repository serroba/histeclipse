import { describe, expect, it } from 'vitest';

import { LAYER_GROUPS } from '../state/layerCatalog';
import { parseViewState, serializeViewState } from '../state/url';
import type { Span, ViewState } from '../state/viewState';
import { anchorQuery } from '../text/anchors';
import {
  arrivalSearch,
  destinationAnchor,
  destinationById,
  DESTINATIONS,
  destinationsIn,
  TOPICS,
} from './destinations';
import { frameSpan, showsFrame } from './frame';
import source from './destinations.ts?raw';

const NOW = new Date('2026-11-15T00:00:00Z');

/** Arriving at a destination from the view a reader has. */
function arrive(id: string, from: string): ViewState {
  const destination = destinationById(id);
  if (destination === undefined) throw new Error(`no destination ${id}`);
  const { state, warnings } = parseViewState(
    anchorQuery(destinationAnchor(destination), from),
    NOW,
  );
  expect(warnings).toEqual([]);
  return state;
}

function spanOf(state: ViewState): Span {
  return state.ma === null ? 'years' : state.deepScale;
}

const SPANS_OF = new Map(
  LAYER_GROUPS.flatMap((group) => group.layers).map((layer) => [layer.id, layer.spans]),
);

/** A reader in the years, with a calendar and sky culture of their own and an eclipse open. */
const READER =
  'v=1&mode=globe&t=1133-08-02T12:00Z&cal=julian&cam=10.0000,10.0000,3.00&layers=eclipses&sel=solar:1133-08-02&culture=chinese&years=hebrew';

describe('destinations', () => {
  it('Given the registry, Then ids are unique, stable in form, and every topic has some', () => {
    const ids = DESTINATIONS.map((destination) => destination.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]{0,47}$/);
    for (const topic of TOPICS) expect(destinationsIn(topic).length).toBeGreaterThan(0);
  });

  it('Given the three reference journeys, Then each has a destination (#724)', () => {
    for (const id of ['moon-landings', 'human-origins', 'ancient-australia']) {
      expect(destinationById(id)).toBeDefined();
    }
  });

  it.each(DESTINATIONS.map((destination) => [destination.id]))(
    'Given %s, When it is arrived at, Then its link reads cleanly, names it, and each of its layers draws there',
    (id) => {
      const state = arrive(id, READER);
      expect(state.explore).toBe(id);
      // It lands inside its own time, on the span that draws it (#729).
      const frame = destinationById(id)?.frame;
      if (frame === undefined) throw new Error(`${id}: no frame`);
      expect(showsFrame(state, frame), `${id} lands in its frame`).toBe(true);
      expect(spanOf(state)).toBe(frameSpan(frame));
      const view = new URLSearchParams(destinationById(id)?.view);
      for (const layer of (view.get('layers') ?? '').split(',').filter(Boolean)) {
        expect(SPANS_OF.get(layer as never), `${id}: ${layer}`).toContain(spanOf(state));
      }
    },
  );

  it('Given a reader with an eclipse open, When they arrive at Human origins, Then where and when are replaced and how things are shown is kept', () => {
    const state = arrive('human-origins', READER);
    expect(state.ma).toBe(0.315);
    expect(state.deepScale).toBe('ice');
    expect(state.selection).toBeNull();
    expect(state.camera.target).toEqual({ latitude: 10, longitude: 5 });
    expect(state.culture).toBe('chinese');
    expect(state.years).toBe('hebrew');
    // The reader's eclipses stay on; they draw again back in the years.
    expect([...state.layers].sort()).toEqual(['eclipses', 'humans']);
  });

  it('Given a destination, When a search anchor opens next, Then the link no longer names the destination', () => {
    const at = serializeViewState(arrive('moon-landings', READER));
    const { state } = parseViewState(
      anchorQuery({ body: 'earth', view: 't=-1222-03-05&sel=solar:-1222-03-05' }, at),
      NOW,
    );
    expect(state.explore).toBeNull();
    expect(state.mission).toBeNull();
  });
});

describe('a link to a destination', () => {
  it('Given only its id, Then it opens the destination’s view, keeping the link’s other settings', () => {
    const { state, warnings } = parseViewState(
      arrivalSearch('?explore=ancient-australia&culture=chinese'),
      NOW,
    );
    expect(warnings).toEqual([]);
    expect(state.explore).toBe('ancient-australia');
    expect(state.ma).toBe(100);
    expect(state.layers).toEqual(new Set(['plates', 'fossils']));
    expect(state.culture).toBe('chinese');
  });

  it('Given a view of its own or an unknown id, Then the link is left as it is', () => {
    const own = '?explore=human-origins&ma=0.1&scale=ice';
    expect(arrivalSearch(own)).toBe(own);
    expect(arrivalSearch('?explore=atlantis')).toBe('?explore=atlantis');
    expect(arrivalSearch('?t=2000-01-01T00:00Z')).toBe('?t=2000-01-01T00:00Z');
  });
});

describe('the registry loads nothing', () => {
  it('Given its source, Then it fetches no data and imports only types and the anchor link maths', () => {
    expect(source).not.toMatch(/fetch|import\(/);
    const imports = [...source.matchAll(/from '([^']+)'/g)].map((match) => match[1]);
    expect(imports).toEqual([
      '../state/viewState',
      '../time/present',
      '../text/anchors',
      './frame',
      '../text/passages',
    ]);
  });
});
