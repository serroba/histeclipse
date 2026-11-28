// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { parseLife, type LifeData, type LifeSite } from '../../data/lifeStories';
import { createLifeCard, placeSaid, spanSaid } from './card';
import { loadLifePictures } from './lifePictures';
import { marksAt, type Mark } from './marks';
import { storyOf, type Story } from './story';

const FOLDER = join(import.meta.dirname, '../../../public/data/life-stories');
const text = (name: string): string => readFileSync(join(FOLDER, `${name}.json`), 'utf8');
const mammals = parseLife(JSON.parse(text('mammals')));
const pictures = await loadLifePictures('pictures.json', () =>
  Promise.resolve(new Response(text('pictures'))),
);

const pbdbOf = (data: LifeData, name: string): number =>
  data.nodes.find((node) => node.name === name)?.pbdb ?? -1;

/** The cats' story, the lion's genus picked out. */
const story = storyOf(mammals, pbdbOf(mammals, 'Felidae'), pbdbOf(mammals, 'Panthera'));
if (story === null) throw new Error('no story of the cats');

const cats: Story = story;

function markAt(ma: number, is: (mark: Mark) => boolean): Mark {
  const mark = marksAt(cats, ma).find(is);
  if (mark === undefined) throw new Error('no such mark in the cats’ story');
  return mark;
}

/** Panthera's site with the most finds, 5 million years ago: a living kind, the one picked. */
const panthera = markAt(5, (mark) => mark.node.name === 'Panthera');
/** An extinct kind at a step in the middle of its record. */
const extinct = markAt(10, (mark) => !mark.node.living && mark.kind !== 'ended');
/** An extinct kind, a step after its last finds: where it was last seen. */
const lost = markAt(0, (mark) => mark.kind === 'ended');

const site = (ma: number, over: Partial<LifeSite> = {}): LifeSite => ({
  ma,
  latitude: -12.4,
  longitude: -70.6,
  finds: 2,
  region: 1,
  celsius: 24.6,
  ...over,
});

/** A mark by hand, of a kind with these sites, at the first of them. */
function madeMark(sites: readonly LifeSite[], over: Partial<Mark['node']> = {}): Mark {
  const node = { ...panthera.node, name: 'Madeupia', pbdb: 99, sites, ...over };
  return { ...panthera, node, site: sites[0] ?? site(5), kind: 'found' };
}

function opened() {
  const actions = { tell: vi.fn(), goTo: vi.fn(), close: vi.fn() };
  const card = createLifeCard(actions);
  const { root } = card;
  const one = (selector: string): HTMLElement | null => root.querySelector<HTMLElement>(selector);
  const facts = (): Record<string, string> =>
    Object.fromEntries(
      [...root.querySelectorAll('.life-fact')].map((fact) => [
        `${fact.closest('dl') === root.querySelector('dl') ? 'site' : 'kind'} ${fact.querySelector('dt')?.textContent ?? ''}`,
        fact.querySelector('dd')?.textContent ?? '',
      ]),
    );
  return { card, actions, root, one, facts };
}

describe('a place in words', () => {
  it('is said in whole degrees north or south, east or west', () => {
    expect(placeSaid(30.2, 78.9)).toBe('30° N, 79° E');
    expect(placeSaid(-12.6, -70.4)).toBe('13° S, 70° W');
    expect(placeSaid(0, 0)).toBe('0° N, 0° E');
  });
});

describe('the years a step covers', () => {
  it('are half a step either side of its middle, and the last half step for today’s', () => {
    expect(spanSaid(10, 5)).toBe('12.5 to 7.5 million years ago');
    expect(spanSaid(0, 5)).toBe('in the last 2.5 million years');
  });
});

describe('a site’s card', () => {
  it('is hidden until a dot is tapped, then names the kind, its ancestors and how it stands', () => {
    const { card, root, one } = opened();
    expect(root.hidden).toBe(true);
    expect(root.getAttribute('aria-label')).toBe('A site of fossil finds');
    card.show(panthera, mammals, null);
    expect(root.hidden).toBe(false);
    expect(one('.life-title')?.textContent).toBe('Panthera');
    expect(one('.life-subtitle')?.textContent).toBe(
      'a kind (genus) of mammal › carnivoran › cat › Felinae · living today',
    );
    // Before the pictures have loaded: no silhouette, no lead picture, no credit.
    expect(one('.life-emblem')).toBeNull();
    expect(one('.life-lead')).toBeNull();
    expect(one('.life-note')?.textContent).not.toContain('Silhouette');
  });

  it('says of this site how many finds and when, where it lay then and is today, and how warm', () => {
    const { card, facts, root } = opened();
    card.show(panthera, mammals, pictures);
    const at = panthera.site;
    const globe = Math.round(mammals.globe.get(5) ?? NaN);
    expect([...root.querySelectorAll('h3')].map((each) => each.textContent)).toEqual([
      'This site',
      'All of Panthera’s finds',
    ]);
    expect(facts()).toMatchObject({
      'site Finds': `${String(at.finds)}, 7.5 to 2.5 million years ago`,
      'site Where': `${placeSaid(at.latitude, at.longitude)} then; in ${mammals.regions[at.region] ?? ''} today`,
      'site Climate': `about ${String(Math.round(at.celsius ?? NaN))} °C there, a year’s mean; the globe averaged ${String(globe)} °C (modelled)`,
    });
  });

  it('says of the kind’s whole record when its finds run and where in today’s world', () => {
    const { card, facts } = opened();
    card.show(panthera, mammals, pictures);
    const { sites } = panthera.node;
    const finds = sites.reduce((sum, each) => sum + each.finds, 0);
    expect(facts()['kind When']).toBe('from about 10 to the last few million years ago');
    expect(facts()['kind Where']).toMatch(
      new RegExp(`^Asia, .+ and .+: ${String(finds)} finds at ${String(sites.length)} sites$`),
    );
  });

  it('shows the kind’s silhouette, Wikipedia’s picture and the silhouette’s credit once loaded', () => {
    const { card, one, root } = opened();
    card.show(panthera, mammals, pictures);
    const silhouette = pictures.names['Panthera']?.silhouette;
    expect(one('.life-emblem img')?.getAttribute('src')).toBe(silhouette?.src);
    expect(one('.life-body > figure.life-lead img')?.getAttribute('alt')).toBe(
      'Wikipedia’s lead picture for Panthera',
    );
    const links = [...root.querySelectorAll('.life-note a')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      `https://paleobiodb.org/classic/basicTaxonInfo?taxon_no=${String(panthera.node.pbdb)}`,
      silhouette?.page,
    ]);
    expect(links[0]?.textContent).toBe('Panthera in the Paleobiology Database');
    expect(one('.life-note')?.textContent).toMatch(
      / Silhouette: Panthera onca, by .+ \(PhyloPic\)\.$/,
    );
  });

  it('says an extinct kind is extinct, and at its last finds that these are among them', () => {
    const { card, one } = opened();
    card.show(extinct, mammals, pictures);
    expect(one('.life-subtitle')?.textContent).toMatch(/ · extinct$/);
    card.show(lost, mammals, pictures);
    expect(one('.life-subtitle')?.textContent).toMatch(
      / · extinct: these are among its last finds$/,
    );
  });

  it('is cleared and hidden with no mark, or with no story to read it from', () => {
    const { card, root } = opened();
    card.show(panthera, mammals, pictures);
    card.show(null, mammals, pictures);
    expect(root.hidden).toBe(true);
    expect(root.children).toHaveLength(0);
    card.show(panthera, mammals, pictures);
    expect(root.hidden).toBe(false);
    card.show(panthera, null, pictures);
    expect(root.hidden).toBe(true);
    expect(root.children).toHaveLength(0);
  });
});

describe('the ways on from a site’s card', () => {
  it('tells the kind’s own story, goes to its oldest finds, and closes', () => {
    const { card, actions, one } = opened();
    card.show(panthera, mammals, pictures);
    expect(one('.life-play')?.textContent).toBe('Tell its story');
    one('.life-play')?.click();
    expect(actions.tell).toHaveBeenCalledExactlyOnceWith(panthera.node);
    expect(one('.life-other')?.textContent).toBe('Go to its oldest finds');
    one('.life-other')?.click();
    const [oldest] = panthera.node.sites;
    expect(oldest?.ma).toBe(10);
    expect(actions.goTo).toHaveBeenCalledExactlyOnceWith(10, oldest);
    expect(one('.life-close')?.getAttribute('aria-label')).toBe('Close');
    one('.life-close')?.click();
    expect(actions.close).toHaveBeenCalledOnce();
  });
});

describe('a card of a kind with an unusual record', () => {
  it('gives the kind’s common name first where it has one', () => {
    const { card, one } = opened();
    card.show(madeMark([site(5)], { common: 'made-up cat', living: false }), mammals, null);
    expect(one('.life-subtitle')?.textContent).toBe(
      'made-up cat · a kind (genus) of mammal › carnivoran › cat › Felinae · extinct',
    );
  });

  it('says finds in a single step by that step’s years, and between two steps by both', () => {
    const { card, facts } = opened();
    card.show(madeMark([site(5), site(5, { region: 0 })]), mammals, null);
    expect(facts()).toMatchObject({
      'kind When': '7.5 to 2.5 million years ago',
      'kind Where': 'South America and North America: 4 finds at 2 sites',
    });
    card.show(madeMark([site(15), site(10)]), mammals, null);
    expect(facts()).toMatchObject({
      'kind When': 'from about 15 to 10 million years ago',
      'kind Where': 'South America: 4 finds at 2 sites',
    });
  });

  it('leaves the climate out where the map has no temperature there, and the globe’s mean where it has none', () => {
    const { card, facts } = opened();
    card.show(madeMark([site(5, { celsius: null })]), mammals, null);
    expect(facts()['site Climate']).toBeUndefined();
    card.show(madeMark([site(5)]), { ...mammals, globe: new Map() }, null);
    expect(facts()['site Climate']).toBe('about 25 °C there, a year’s mean (modelled)');
  });

  it('still draws for a file that names no such region or ancestor, or a kind with no sites', () => {
    const { card, actions, one, facts } = opened();
    card.show(madeMark([site(5, { region: 99 })], { parent: 999_999 }), mammals, null);
    expect(one('.life-subtitle')?.textContent).toBe('a kind (genus) of  · living today');
    expect(facts()['site Where']).toBe('12° S, 71° W then; in  today');
    expect(facts()['kind Where']).toBe(': 2 finds at 1 site');
    card.show(madeMark([]), mammals, null);
    expect(facts()).toMatchObject({
      'kind When': 'in the last 2.5 million years',
      'kind Where': ': 0 finds at 0 sites',
    });
    one('.life-other')?.click();
    expect(actions.goTo).not.toHaveBeenCalled();
  });
});
