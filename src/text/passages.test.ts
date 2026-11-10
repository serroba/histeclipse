import { describe, expect, it } from 'vitest';

import data from '../../public/data/passages.json';
import type { Craft } from '../data/spacecraft';
import type { FamousEclipse } from '../data/famousEclipses';
import { SOURCES, WHYS } from '../sources/registry';
import type { LayerChoice } from '../state/layerCatalog';
import { parseViewState } from '../state/url';
import { eclipsePassages, landingPassages, loadPassages, type Passage } from './passages';
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

  it('Given Apollo 11’s lander, Then it is anchored where it came down on the Moon, that day', () => {
    const eagle = passages.find(
      (passage) => passage.kind === 'landing' && passage.text.includes('Craft: Eagle'),
    );
    expect(eagle?.title).toBe('Apollo 11');
    const anchor = eagle?.anchors[0];
    expect(anchor?.body).toBe('moon');
    expect(anchor?.at?.[0]).toBeCloseTo(0.69, 1);
    expect(anchor?.view).toContain('t=1969-07-20T20:17Z');
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
      landingPassages([
        craft(undefined),
        down('Eros', 1, 2, '2001-02-12'),
        down('Luna', null, 2, '1970-01-01'),
        down('Luna', 1, null, '1970-01-01'),
      ]),
    ).toEqual([]);
  });

  it('Given landings dated only to a day, a month, or not at all, Then the view says only what is known', () => {
    const [day, month, none] = landingPassages([
      down('Mars', 1, 200, '1971-12-02'),
      down('Venus', 1, -313.2, '1975-06?'),
      down('Luna', 1, 2, null),
    ]);
    expect(day?.anchors[0]?.view).toContain('t=1971-12-02T12:00Z');
    expect(day?.anchors[0]?.at).toEqual([1, -160]);
    expect(month?.anchors[0]?.view).not.toContain('t=');
    expect(month?.anchors[0]?.when).toEqual([1975, 1975]);
    expect(month?.anchors[0]?.at?.[1]).toBeCloseTo(46.8, 6);
    expect(none?.anchors[0]?.when).toBeUndefined();
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
