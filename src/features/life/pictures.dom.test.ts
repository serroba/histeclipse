// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { LifeNode } from '../../data/lifeStories';
import { loadLifePictures, type LifePictures, type Silhouette } from './lifePictures';
import { kindChip, leadPicture, pictureOf, silhouetteCredits, silhouetteImage } from './pictures';

const FILE = join(import.meta.dirname, '../../../public/data/life-stories/pictures.json');
const real = await loadLifePictures('pictures.json', () =>
  Promise.resolve(new Response(readFileSync(FILE, 'utf8'))),
);

const silhouette = (of: string): Silhouette => ({
  src: `https://images.phylopic.org/images/${of}/thumbnail/128x128.png`,
  of,
  by: 'A. Drawer',
  licence: 'CC0 1.0',
  licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  page: `https://www.phylopic.org/images/${of}`,
});

const image = (artist: string) => ({
  src: 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Smilodon.jpg',
  width: 320,
  height: 200,
  artist,
  licence: 'CC BY-SA 4.0',
  licenceUrl: null,
  filePage: 'https://commons.wikimedia.org/wiki/File:Smilodon.jpg',
});

/** Pictures by hand, one of each shape a name can have. */
const made: LifePictures = {
  ...real,
  names: {
    Smilodon: {
      silhouette: silhouette('Smilodon'),
      wikipedia: { page: 'https://en.wikipedia.org/wiki/Smilodon', image: image('W. Painter') },
    },
    Homotherium: { silhouette: silhouette('Homotherium'), wikipedia: null },
    Dinofelis: {
      silhouette: null,
      wikipedia: { page: 'https://en.wikipedia.org/wiki/Dinofelis', image: null },
    },
    Metailurus: {
      silhouette: null,
      wikipedia: {
        page: 'https://en.wikipedia.org/wiki/Metailurus',
        image: image(`${'A very long credit that runs on, '.repeat(4)}to its end`),
      },
    },
  },
};

const node = (name: string): LifeNode => ({
  index: 1,
  pbdb: 7,
  name,
  common: '',
  rank: 'genus',
  parent: 0,
  children: [],
  living: false,
  sites: [],
});

describe('a name’s picture', () => {
  it('is the file’s entry for that name, and none without the file or the name', () => {
    expect(pictureOf(real, 'Panthera')?.silhouette?.of).toBe('Panthera onca');
    expect(pictureOf(real, 'Panthera')?.wikipedia?.page).toBe(
      'https://en.wikipedia.org/wiki/Panthera',
    );
    expect(pictureOf(real, 'No such animal')).toBeNull();
    expect(pictureOf(null, 'Panthera')).toBeNull();
  });
});

describe('a silhouette', () => {
  it('is drawn at the size asked, from PhyloPic, with its credit as its tooltip', () => {
    const drawn = silhouetteImage(silhouette('Smilodon'), 22);
    expect(drawn.className).toBe('life-silhouette');
    expect(drawn.getAttribute('src')).toBe(
      'https://images.phylopic.org/images/Smilodon/thumbnail/128x128.png',
    );
    expect(drawn.getAttribute('width')).toBe('22');
    expect(drawn.getAttribute('height')).toBe('22');
    expect(drawn.getAttribute('alt')).toBe('');
    expect(drawn.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(drawn.title).toBe('Silhouette: Smilodon, by A. Drawer, CC0 1.0 (PhyloPic)');
  });
});

describe('a kind by name', () => {
  it('links to its Wikipedia page and shows its silhouette, kept for the credits', () => {
    const shown: Silhouette[] = [];
    const chip = kindChip(node('Smilodon'), made, shown);
    expect(chip.tagName).toBe('A');
    expect(chip.className).toBe('life-kind is-linked');
    expect(chip.getAttribute('href')).toBe('https://en.wikipedia.org/wiki/Smilodon');
    expect(chip.getAttribute('target')).toBe('_blank');
    expect(chip.getAttribute('rel')).toBe('noopener');
    expect(chip.title).toBe('Smilodon on Wikipedia');
    expect(chip.querySelector('img.life-silhouette')?.getAttribute('width')).toBe('22');
    expect(chip.querySelector('span')?.textContent).toBe('Smilodon');
    expect(shown).toEqual([silhouette('Smilodon')]);
  });

  it('is plain with no page, its silhouette still shown', () => {
    const shown: Silhouette[] = [];
    const chip = kindChip(node('Homotherium'), made, shown);
    expect(chip.tagName).toBe('SPAN');
    expect(chip.className).toBe('life-kind');
    expect(chip.querySelector('img')).not.toBeNull();
    expect(shown).toHaveLength(1);
  });

  it('is a link with no silhouette where it has only a page', () => {
    const shown: Silhouette[] = [];
    const chip = kindChip(node('Dinofelis'), made, shown);
    expect(chip.tagName).toBe('A');
    expect(chip.querySelector('img')).toBeNull();
    expect(shown).toEqual([]);
  });

  it('is its bare name with no picture, or before the pictures have loaded', () => {
    const shown: Silhouette[] = [];
    for (const chip of [
      kindChip(node('Unknownus'), made, shown),
      kindChip(node('Smilodon'), null, shown),
    ]) {
      expect(chip.tagName).toBe('SPAN');
      expect(chip.children).toHaveLength(1);
    }
    expect(shown).toEqual([]);
  });
});

describe('Wikipedia’s lead picture for a name', () => {
  it('is a figure with the picture, the page, and the picture’s author and licence', () => {
    const figure = leadPicture(made, 'Smilodon');
    expect(figure?.tagName).toBe('FIGURE');
    const picture = figure?.querySelector('img');
    expect(picture?.getAttribute('src')).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/a/a0/Smilodon.jpg',
    );
    expect(picture?.getAttribute('alt')).toBe('Wikipedia’s lead picture for Smilodon');
    expect(picture?.getAttribute('width')).toBe('320');
    expect(picture?.getAttribute('height')).toBe('200');
    const links = [...(figure?.querySelectorAll('figcaption a') ?? [])];
    expect(links.map((link) => link.textContent)).toEqual([
      'Smilodon on Wikipedia',
      'W. Painter, CC BY-SA 4.0',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://en.wikipedia.org/wiki/Smilodon',
      'https://commons.wikimedia.org/wiki/File:Smilodon.jpg',
    ]);
    expect(figure?.textContent).toContain('which may be a fossil, a reconstruction');
  });

  it('cuts a credit that runs to a paragraph, and says its page has it whole', () => {
    const credit = leadPicture(made, 'Metailurus')?.querySelectorAll('figcaption a')[1];
    expect(credit?.textContent).toMatch(
      /^A very long credit .{1,60}… \(credits in full on its page\), CC BY-SA 4\.0$/,
    );
  });

  it('is a line to read more where the page has no free picture', () => {
    const line = leadPicture(made, 'Dinofelis');
    expect(line?.tagName).toBe('P');
    expect(line?.className).toBe('life-reference');
    expect(line?.textContent).toBe('Read more: Dinofelis on Wikipedia');
    expect(line?.querySelector('a')?.getAttribute('href')).toBe(
      'https://en.wikipedia.org/wiki/Dinofelis',
    );
  });

  it('is nothing for a name with no page, or before the pictures have loaded', () => {
    expect(leadPicture(made, 'Homotherium')).toBeNull();
    expect(leadPicture(made, 'Unknownus')).toBeNull();
    expect(leadPicture(null, 'Smilodon')).toBeNull();
  });

  it('is drawn for the real cats from the file', () => {
    expect(leadPicture(real, 'Felidae')?.querySelector('img')?.getAttribute('alt')).toBe(
      'Wikipedia’s lead picture for Felidae',
    );
  });
});

describe('the credits of the silhouettes shown', () => {
  it('are folded away, each silhouette once, a link to its page at PhyloPic', () => {
    const credits = silhouetteCredits([
      silhouette('Smilodon'),
      silhouette('Homotherium'),
      silhouette('Smilodon'),
    ]);
    expect(credits?.tagName).toBe('DETAILS');
    expect(credits?.open).toBe(false);
    expect(credits?.querySelector('summary')?.textContent).toBe(
      'Silhouettes: 2 from PhyloPic, credited here',
    );
    const links = [...(credits?.querySelectorAll('li a') ?? [])];
    expect(links.map((link) => link.textContent)).toEqual([
      'Smilodon, by A. Drawer, CC0 1.0',
      'Homotherium, by A. Drawer, CC0 1.0',
    ]);
    expect(links[0]?.getAttribute('href')).toBe('https://www.phylopic.org/images/Smilodon');
  });

  it('are nothing with no silhouette shown', () => {
    expect(silhouetteCredits([])).toBeNull();
  });
});
