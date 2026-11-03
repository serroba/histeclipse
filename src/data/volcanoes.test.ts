import { describe, expect, it } from 'vitest';

import details from '../../public/data/volcano-details.json';
import data from '../../public/data/volcanoes.json';
import {
  eruptionText,
  eruptionsNear,
  loadVolcanoDetails,
  loadVolcanoes,
  volcanoCard,
  volcanoesText,
  type VolcanoDetails,
  type Volcanoes,
} from './volcanoes';

const serve = (body: unknown) => (): Promise<Response> => Promise.resolve(Response.json(body));

const small: Volcanoes = {
  schemaVersion: 1,
  credit: 'GVP',
  source: 'https://volcano.si.edu',
  accessed: '2026-11-04',
  evidence: ['Observations: Reported', 'Isotopic: 14C (calibrated)'],
  volcanoes: [
    {
      number: 211020,
      name: 'Vesuvius',
      kind: 'Stratovolcano(es)',
      country: 'Italy',
      latitude: 40.821,
      longitude: 14.426,
      elevationM: 1281,
      lastYear: 1944,
    },
    {
      number: 1,
      name: 'Far field',
      kind: '',
      country: '',
      latitude: 0,
      longitude: 0,
      elevationM: null,
      lastYear: null,
    },
  ],
  eruptions: [
    [211020, 79, 0, 10, 24, 5, 1, 0],
    [211020, 100, 0, 0, 0, -1, 1, -1],
    [1, 300, 250, 0, 0, -1, 0, 1],
    // An eruption of a volcano not in the file: left out.
    [999, 79, 0, 0, 0, 2, 1, 0],
  ],
};

const smallDetails: VolcanoDetails = {
  schemaVersion: 1,
  credit: 'GVP',
  volcanoes: {
    '211020': {
      summary: 'One of the best-known volcanoes.',
      photo: {
        src: 'https://volcano.si.edu/gallery/photos/GVP-01531.jpg',
        caption: 'Vesuvius behind Naples.',
        credit: 'Photo by Dan Dzurisin, 1983 (U.S. Geological Survey).',
      },
    },
  },
};

describe('volcanoes', () => {
  it('load and check, the real files too', async () => {
    await expect(loadVolcanoes('/v.json', serve(small))).resolves.toEqual(small);
    await expect(loadVolcanoDetails('/d.json', serve(smallDetails))).resolves.toEqual(smallDetails);
    const real = await loadVolcanoes('/v.json', serve(data));
    expect(real.volcanoes.length).toBeGreaterThan(1000);
    const card = await loadVolcanoDetails('/d.json', serve(details));
    expect(card.volcanoes['211020']?.summary).toContain('Vesuvius');
    // Tambora's 1815 eruption, the largest of recent centuries, is near 1815.
    const tambora = eruptionsNear(real, 1815).find((mark) => mark.volcano.name === 'Tambora');
    expect(tambora?.vei).toBe(7);
  });

  it('marks the volcanoes erupting near a year, or whose dating reaches it, largest first', () => {
    const near = eruptionsNear(small, 80);
    expect(near.map((mark) => mark.volcano.name)).toEqual(['Vesuvius', 'Far field']);
    expect(near[0]?.eruptions.map((eruption) => eruption.year)).toEqual([79, 100]);
    expect(near[0]?.vei).toBe(5);
    expect(near[0]?.uncertain).toBe(false);
    // Far field's eruption is dated ± 250 years, and it is not confirmed.
    expect(near[1]?.vei).toBeNull();
    expect(near[1]?.uncertain).toBe(true);
    expect(eruptionsNear(small, 600)).toEqual([]);
  });

  it('says what it marks, or that nothing erupted near then', () => {
    expect(volcanoesText(eruptionsNear(small, 80), 80)).toBe(
      '2 volcanoes with eruptions dated within 25 years of 80 CE, or whose dating’s ± reaches it, from the Smithsonian’s Global Volcanism Program. The largest: Vesuvius, VEI 5. VEI is the explosivity index, 0 to 8; paler, eruptions not confirmed.',
    );
    expect(volcanoesText(eruptionsNear(small, 600), 600)).toBe(
      'No eruptions dated within 25 years of 600 CE in the Smithsonian’s Global Volcanism Program.',
    );
    expect(volcanoesText(eruptionsNear(small, 400), 400)).toBe(
      '1 volcano with eruptions dated within 25 years of 400 CE, or whose dating’s ± reaches it, from the Smithsonian’s Global Volcanism Program. VEI is the explosivity index, 0 to 8; paler, eruptions not confirmed.',
    );
  });

  it('writes each eruption with its date as known, size and dating', () => {
    const [vesuvius, field] = eruptionsNear(small, 80);
    expect(vesuvius?.eruptions.map(eruptionText)).toEqual([
      '24 Oct 79 CE, VEI 5; Observations: Reported',
      '100 CE, VEI not known',
    ]);
    expect(field?.eruptions.map(eruptionText)).toEqual([
      '300 CE ± 250 years, VEI not known; Isotopic: 14C (calibrated); not confirmed',
    ]);
    const dated = field?.eruptions[0];
    if (dated === undefined) throw new Error('eruption missing');
    expect(eruptionText({ ...dated, month: 3, day: 0, uncertainty: 0 })).toBe(
      'Mar 300 CE, VEI not known; Isotopic: 14C (calibrated); not confirmed',
    );
  });

  it('gives a card the volcano, its eruptions, its photo and summary once loaded', () => {
    const [vesuvius, field] = eruptionsNear(small, 80);
    if (vesuvius === undefined || field === undefined) throw new Error('marks missing');
    expect(volcanoCard(vesuvius, smallDetails)).toEqual({
      title: 'Vesuvius',
      facts: [
        ['Kind', 'Stratovolcano(es)'],
        ['Country', 'Italy'],
        ['Elevation', '1,281 m'],
        ['Last known eruption', '1944 CE'],
        ['Eruption', '24 Oct 79 CE, VEI 5; Observations: Reported'],
        ['Eruption', '100 CE, VEI not known'],
      ],
      links: [
        { label: 'Global Volcanism Program', href: 'https://volcano.si.edu/volcano.cfm?vn=211020' },
      ],
      image: {
        src: 'https://volcano.si.edu/gallery/photos/GVP-01531.jpg',
        alt: 'Photo of Vesuvius',
        credit:
          'Vesuvius behind Naples. Photo by Dan Dzurisin, 1983 (U.S. Geological Survey). Via the Global Volcanism Program.',
      },
      note: 'One of the best-known volcanoes.',
    });
    expect(volcanoCard(vesuvius, null).note).toBe('Loading its summary…');
    const bare = volcanoCard(field, smallDetails);
    expect(bare.facts.slice(0, 1)).toEqual([['Last known eruption', 'not known']]);
    expect(bare.image).toBeUndefined();
    expect(bare.note).toBeUndefined();
  });
});
