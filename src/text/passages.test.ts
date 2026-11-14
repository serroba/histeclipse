import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import data from '../../public/data/passages.json';
import type { Craft } from '../data/spacecraft';
import type { FamousEclipse } from '../data/famousEclipses';
import { SOURCES, WHYS } from '../sources/registry';
import type { LayerChoice } from '../state/layerCatalog';
import { parseViewState } from '../state/url';
import {
  cachedPassages,
  eclipsePassages,
  landingAnchors,
  loadPassages,
  type Passage,
} from './passages';
import { whyPassages } from './passages';

const serve = (body: unknown) => () => Promise.resolve(new Response(JSON.stringify(body)));
const { passages } = await loadPassages('passages.json', serve(data));
const NOW = new Date('2026-11-11T00:00:00Z');
const byId = (id: string): Passage => {
  const found = passages.find((passage) => passage.id === id);
  if (found === undefined) throw new Error(`no ${id}`);
  return found;
};
const opened = (passage: Passage, index = 0) => {
  const anchor = passage.anchors[index];
  if (anchor === undefined) throw new Error(`${passage.id} has no anchor ${String(index)}`);
  return parseViewState(anchor.view, NOW);
};

describe('passages anchored to places and times', () => {
  it('Given every anchor, Then its view opens as a link with nothing ignored, on its body', () => {
    for (const passage of passages) {
      for (const [index, anchor] of passage.anchors.entries()) {
        const { state, warnings } = opened(passage, index);
        expect(warnings, `${passage.id}: ${anchor.view}`).toEqual([]);
        if (anchor.body !== 'earth') expect(state.focus, passage.id).toBe(anchor.body);
      }
    }
  });

  it('Given a mission, Then its link opens its journey: Apollo 11 about Earth, Voyager 2 about the Sun (#712)', () => {
    const apollo = opened(byId('mission:d00273')).state;
    expect(apollo.mission).toBe('d00273');
    expect(apollo.layers.has('spacecraft')).toBe(true);
    expect(apollo.focus).toBe('earth');
    expect(apollo.time.date).toMatchObject({ year: 1969, month: 7, day: 17 });
    const voyager = byId('mission:d00574');
    expect(voyager.kind).toBe('mission');
    expect(voyager.text).toContain('Reaches Neptune, 6 June 1989');
    expect(opened(voyager).state.focus).toBe('sun');
    expect(passages.filter(({ kind }) => kind === 'mission').length).toBeGreaterThan(200);
  });

  it('Given every passage, Then each source it names is in the registry', () => {
    for (const passage of passages) {
      for (const source of passage.sources) expect(SOURCES, passage.id).toHaveProperty(source);
      expect(passage.sources.length > 0 || passage.cite !== undefined, passage.id).toBe(true);
    }
  });

  it('Given a layer’s why, Then its anchor turns the layer on, on its span, with the why open', () => {
    const { state } = opened(byId('why:temperature'));
    expect(state.layers.has('temperature')).toBe(true);
    expect(state.ma).not.toBeNull();
    expect(state.why).toBe('temperature');
    // The sky's why opens the sky.
    expect(opened(byId('why:sky')).state.mode).toBe('sky');
  });

  it('Given the Ugarit eclipse, Then it is anchored to Ugarit in 1223 BCE, picked, with its dispute', () => {
    const ugarit = byId('eclipse:ugarit-1223-bce');
    expect(ugarit.anchors[0]?.at).toEqual([35.6017, 35.7822]);
    expect(ugarit.anchors[0]?.when).toEqual([-1222, -1222]);
    expect(ugarit.text).toContain('disputed');
    expect(ugarit.cite).toContain('KTU 1.78');
    const { state } = opened(ugarit);
    expect(state.selection?.kind).toBe('solar');
    expect(state.location?.latitude).toBeCloseTo(35.6017, 4);
  });

  it('Given Apollo 11, Then where Eagle came down is a place of its own, opening inside the mission (#716)', () => {
    const apollo = byId('mission:d00273');
    expect(apollo.anchors.map(({ label }) => label)).toEqual([undefined, 'Where Eagle came down']);
    const eagle = apollo.anchors[1];
    expect(eagle?.body).toBe('moon');
    expect(eagle?.at?.[0]).toBeCloseTo(0.69, 1);
    const { state } = opened(apollo, 1);
    expect(state.focus).toBe('moon');
    expect(state.mission).toBe('d00273');
    expect(state.time.date).toMatchObject({ year: 1969, month: 7, day: 20 });
  });

  it('Given every craft that came down where the site can show, Then its site is a place in its mission', () => {
    const before = JSON.parse(
      readFileSync(new URL('./landings.fixture.json', import.meta.url), 'utf8'),
    ) as readonly { readonly at: readonly [number, number]; readonly body: string }[];
    const places = new Set(
      passages
        .filter(({ kind }) => kind === 'mission')
        .flatMap(({ anchors }) => anchors.filter(({ at }) => at !== undefined))
        .map(({ body, at }) => `${body} ${String(at)}`),
    );
    expect(before.length).toBeGreaterThan(80);
    expect(before.filter(({ body, at }) => !places.has(`${body} ${String(at)}`))).toEqual([]);
    expect(passages.some(({ id }) => id.startsWith('landing:'))).toBe(false);
  });

  it('Given Io, Then its passage is its story, anchored to Io', () => {
    const io = byId('moon:io');
    expect(io.text).toContain('volcanic');
    expect(io.text).toContain('Found by Galileo Galilei');
    expect(opened(io).state.focus).toBe('io');
  });
});

describe('passages from records with gaps', () => {
  const craft = (landing: Craft['landing'], launch = '1970-01-01'): Craft => ({
    id: 'D9',
    name: 'Probe',
    cospar: '1970-001A',
    nssdc: null,
    launchTag: '1970-001',
    launch,
    owner: 'X',
    state: 'US',
    crewed: false,
    part: false,
    parent: null,
    phases: [['Earth', launch, null, 'O', '-']],
    ...(landing === undefined ? {} : { landing }),
  });
  const down = (world: string, lat: number | null, lon: number | null, date: string | null) =>
    craft({ world, lat, lon, date, site: '-' });

  it('Given landings with no place, on an asteroid, or never down, Then they are left out', () => {
    expect(
      landingAnchors(
        [
          craft(undefined),
          down('Eros', 1, 2, '2001-02-12'),
          down('Luna', null, 2, '1970-01-01'),
          down('Luna', 1, null, '1970-01-01'),
        ],
        null,
      ),
    ).toEqual([]);
  });

  it('Given landings dated only to a day, a month, or not at all, Then the view says only what is known', () => {
    const [day, month, none] = landingAnchors(
      [
        down('Mars', 1, 200, '1971-12-02'),
        down('Venus', 1, -313.2, '1975-06?'),
        down('Luna', 1, 2, null),
      ],
      'd00009',
    );
    expect(day?.view).toContain('t=1971-12-02T12:00Z');
    expect(day?.view).toContain('mission=d00009');
    expect(day?.at).toEqual([1, -160]);
    expect(month?.view).not.toContain('t=');
    expect(month?.when).toEqual([1975, 1975]);
    expect(month?.at?.[1]).toBeCloseTo(46.8, 6);
    expect(none?.when).toBeUndefined();
    expect(day?.label).toBe('Where Probe came down');
  });

  it('Given a lander and what it carried down, at one site, Then the site is one place, named for the lander', () => {
    const lander = down('Luna', 1, 2, '1970-01-01');
    const carried = { ...lander, id: 'D10', name: 'Package', part: true };
    const places = landingAnchors([carried, lander], null);
    expect(places).toHaveLength(1);
    expect(places[0]?.label).toBe('Where Probe came down');
    expect(places[0]?.view).not.toContain('mission=');
  });

  it('Given an eclipse with no place, Then it is anchored to its day alone', () => {
    const eclipse: FamousEclipse = {
      id: 'nowhere',
      kind: 'lunar',
      date: '-0500-01-01',
      title: 'An eclipse',
      summary: 'Seen somewhere.',
      source: 'A chronicle',
      debated: false,
      confidence: 'secure',
    };
    const [passage] = eclipsePassages([eclipse]);
    expect(passage?.anchors[0]?.at).toBeUndefined();
    expect(passage?.anchors[0]?.view).not.toContain('loc=');
    expect(passage?.text).toBe('Seen somewhere.');
  });

  it('Given a deep layer that lands somewhere of its own, Then its why opens there', () => {
    const layer: LayerChoice = {
      id: 'temperature',
      label: 'Temperature',
      about: '',
      spans: ['all'],
      reach: '',
      arrive: { ma: 250, label: 'the Permian' },
    };
    const temperature = whyPassages(WHYS, [layer]).find((p) => p.id === 'why:temperature');
    expect(temperature?.anchors[0]?.view).toBe(
      'layers=temperature&ma=250&scale=all&why=temperature',
    );
  });
});

describe('cachedPassages', () => {
  it('fetches once for every caller, and again after a failure', async () => {
    let calls = 0;
    let failing = true;
    const fetchJson = () => {
      calls += 1;
      return failing
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(new Response(JSON.stringify(data)));
    };
    const shared = cachedPassages('passages.json', fetchJson);
    await expect(shared()).rejects.toThrow('offline');
    failing = false;
    const [first, second] = await Promise.all([shared(), shared()]);
    expect(first).toBe(second);
    expect(first.length).toBe(passages.length);
    expect(calls).toBe(2);
  });
});
