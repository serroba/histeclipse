import { describe, expect, it } from 'vitest';

import { coastlineText } from './deepTimeBar';

describe('coastlineText', () => {
  it('says the sea level and whose', () => {
    expect(
      coastlineText({
        coast: 'bintanja-2008',
        seaLevel: -121.3,
        label: 'Bintanja & van de Wal 2008',
        instead: null,
      }),
    ).toBe('Coastline at −121 m, following Bintanja & van de Wal 2008.');
    expect(
      coastlineText({
        coast: 'spratt-2016',
        seaLevel: 0.2,
        label: 'Spratt & Lisiecki 2016',
        instead: null,
      }),
    ).toBe('Coastline at today’s sea level, following Spratt & Lisiecki 2016.');
    expect(
      coastlineText({
        coast: 'spratt-2016',
        seaLevel: 6,
        label: 'Spratt & Lisiecki 2016',
        instead: null,
      }),
    ).toContain('+6 m');
  });

  it('says when another source stands in', () => {
    expect(
      coastlineText({
        coast: 'spratt-2016',
        seaLevel: -60,
        label: 'Bintanja & van de Wal 2008',
        instead: 'Spratt & Lisiecki 2016',
      }),
    ).toBe(
      'Coastline at −60 m, following Bintanja & van de Wal 2008. Spratt & Lisiecki 2016 does not reach this far; Bintanja & van de Wal 2008 stands in.',
    );
  });

  it('waits for the reconstructions', () => {
    expect(
      coastlineText({ coast: 'bintanja-2008', seaLevel: null, label: null, instead: null }),
    ).toBe('Coastline: loading sea level…');
  });
});
