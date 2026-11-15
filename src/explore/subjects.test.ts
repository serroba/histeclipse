import { describe, expect, it } from 'vitest';

import { LAYER_GROUPS } from '../state/layerCatalog';
import { parseViewState } from '../state/url';
import { LAYERS } from '../state/viewState';
import { TOPICS } from './destinations';
import { groupTopic, subjectQuery, subjectsIn } from './subjects';

const NOW = new Date('2026-11-15T00:00:00Z');
const at = (query: string) => {
  const { state, warnings } = parseViewState(query, NOW);
  expect(warnings).toEqual([]);
  return state;
};

describe('all subjects', () => {
  it('Given the catalogue, Then every group is a topic, and every layer a subject under one', () => {
    for (const group of LAYER_GROUPS) expect(groupTopic(group.name), group.name).toBeDefined();
    const all = TOPICS.flatMap((topic) => subjectsIn(topic).map((subject) => subject.layer));
    expect([...all].sort()).toEqual([...LAYERS].sort());
  });

  it('Given the climate, Then warming, ocean heat and the ozone hole are among its subjects', () => {
    const climate = subjectsIn('climate').map((subject) => subject.layer);
    expect(climate).toEqual(expect.arrayContaining(['warming', 'oceanHeat', 'ozone']));
  });

  it('Given a layer that draws where the reader is, Then it is turned on and nothing else moves', () => {
    const state = at(subjectQuery('ozone', 't=2006-10-01T12:00Z&cam=-70,40,3.00&layers=empires'));
    expect(state.layers).toEqual(new Set(['empires', 'ozone']));
    expect(state.ma).toBeNull();
    expect(state.camera.target).toEqual({ latitude: -70, longitude: 40 });
  });

  it('Given a layer that draws elsewhere, Then it goes there: its own moment, a span’s, or the years', () => {
    const humans = at(subjectQuery('humans', 't=2006-10-01T12:00Z'));
    expect([humans.ma, humans.deepScale]).toEqual([0.315, 'ice']);
    const fossils = at(subjectQuery('fossils', 't=2006-10-01T12:00Z'));
    expect([fossils.ma, fossils.deepScale]).toEqual([66, 'all']);
    const ozone = at(subjectQuery('ozone', 'ma=100&scale=all'));
    expect(ozone.ma).toBeNull();
    const plates = at(subjectQuery('plates', 'ma=0.1&scale=ice'));
    expect([plates.ma, plates.deepScale]).toEqual([0.1, 'ice']);
  });
});
