// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PerspectiveCamera } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseLife, type LifeData } from '../../data/lifeStories';
import type { LayerHost, SurfacePin } from '../../globe/layerHost';
import { loadLifePictures } from './lifePictures';
import { marksAt, type Mark } from './marks';
import { lifeMarksLayer, type LifeMarks } from './marksLayer';
import { storyOf, type Story } from './story';

const FOLDER = join(import.meta.dirname, '../../../public/data/life-stories');
const text = (name: string): string => readFileSync(join(FOLDER, `${name}.json`), 'utf8');
const mammals = parseLife(JSON.parse(text('mammals')));
const pictures = await loadLifePictures('pictures.json', () =>
  Promise.resolve(new Response(text('pictures'))),
);

const pbdbOf = (data: LifeData, name: string): number =>
  data.nodes.find((node) => node.name === name)?.pbdb ?? -1;

function told(clade: string, focus: string | null): Story {
  const story = storyOf(
    mammals,
    pbdbOf(mammals, clade),
    focus === null ? null : pbdbOf(mammals, focus),
  );
  if (story === null) throw new Error(`no story of ${clade}`);
  return story;
}

/** The cats 10 million years ago: 73 sites of 22 kinds, more kinds than there is room to picture. */
const cats = marksAt(told('Felidae', 'Panthera'), 10);
/** The lion's genus alone, 5 million years ago: 11 sites of the one kind. */
const lions = marksAt(told('Panthera', null), 5);

/** The globe's frame on the page, and a dot's box in it by its place among the dots. */
const FRAME = new DOMRect(10, 20, 800, 600);
const dotBox = (at: number): DOMRect => new DOMRect(310 + at * 20, 220 + at * 10, 12, 12);

function fakeHost() {
  const container = document.createElement('div');
  document.body.append(container);
  Object.defineProperty(container, 'clientWidth', { value: FRAME.width });
  Object.defineProperty(container, 'clientHeight', { value: FRAME.height });
  const framed = vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(FRAME);
  const camera = new PerspectiveCamera(45, FRAME.width / FRAME.height, 0.1, 100);
  camera.position.set(0, 0, 4.5);
  camera.updateMatrixWorld();
  const shown: (readonly SurfacePin[] | null)[] = [];
  const frames: (() => void)[] = [];
  const requestRender = vi.fn();
  const host = {
    container,
    camera,
    requestRender,
    afterRender: (place: () => void) => frames.push(place),
    // As the globe does: the pins' elements go into the layer, placed after each frame.
    surfaceLabels: (_priority: number, layer: HTMLElement) => ({
      show: (pins: readonly SurfacePin[] | null) => {
        shown.push(pins);
        layer.replaceChildren(...(pins ?? []).map((pin) => pin.element));
      },
    }),
  } as unknown as LayerHost;
  const layer = lifeMarksLayer(host);
  const all = <E extends Element = HTMLElement>(selector: string): E[] => [
    ...container.querySelectorAll<E>(selector),
  ];
  return {
    layer,
    container,
    shown,
    requestRender,
    framed,
    all,
    /** Lay the dots out as the globe would, then run what the layer does after a frame. */
    frame: (laidOut = true): void => {
      if (laidOut) {
        all('.life-mark').forEach((dot, at) => {
          vi.spyOn(dot, 'getBoundingClientRect').mockReturnValue(dotBox(at));
        });
      }
      for (const place of frames) place();
    },
  };
}

function marksOf(marks: readonly Mark[], over: Partial<LifeMarks> = {}): LifeMarks {
  return {
    key: 'cats:10',
    marks,
    silhouette: (name) => pictures.names[name]?.silhouette ?? null,
    pick: vi.fn(),
    picked: null,
    ...over,
  };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('the dots of an animal’s story on the globe', () => {
  it('puts a button at each site, larger with more finds, saying what was found there', () => {
    const { layer, container, shown, requestRender } = fakeHost();
    layer.update(marksOf(lions));
    const [pins] = shown;
    expect(pins).toHaveLength(lions.length);
    const [first] = pins ?? [];
    const [lead] = lions;
    expect(first?.element.tagName).toBe('BUTTON');
    expect(first?.element.getAttribute('type')).toBe('button');
    expect(first?.element.className).toBe('empire-label life-mark is-found');
    expect(first?.element.title).toBe('Panthera: 16 finds');
    expect(first?.element.getAttribute('aria-label')).toBe('Panthera: 16 finds');
    expect(first?.point).toEqual({ latitude: lead?.latitude, longitude: lead?.longitude });
    // 16 finds: 9 + 3.2 × √16 px across, anchored at its middle.
    const dot = first?.element.querySelector<HTMLElement>('i.life-dot');
    expect(dot?.style.width).toBe('22px');
    expect(dot?.style.height).toBe('22px');
    expect(first?.anchor).toBe(11);
    expect(container.dataset['lifeMarks']).toBe(String(lions.length));
    expect(container.querySelector('.empire-labels.life-marks')?.children).toHaveLength(
      lions.length,
    );
    expect(requestRender).toHaveBeenCalledOnce();
  });

  it('draws no dot wider than 26 px however many the finds', () => {
    const { layer, shown } = fakeHost();
    const [lead] = lions;
    if (lead === undefined) throw new Error('no marks');
    layer.update(marksOf([{ ...lead, finds: 900 }]));
    expect(shown[0]?.[0]?.anchor).toBe(13);
  });

  it('picks a site when its dot is tapped, and keeps the tap from the globe beneath', () => {
    const { layer, container, all } = fakeHost();
    const through = vi.fn();
    container.addEventListener('click', through);
    const drawn = marksOf(lions);
    layer.update(drawn);
    all('.life-mark')[2]?.click();
    expect(drawn.pick).toHaveBeenCalledExactlyOnceWith(lions[2]);
    expect(through).not.toHaveBeenCalled();
  });

  it('shows which dot’s card is open', () => {
    const { layer, all } = fakeHost();
    layer.update(marksOf(lions, { picked: lions[3] ?? null }));
    expect(all('.life-mark').map((dot) => dot.classList.contains('is-picked'))).toEqual(
      lions.map((_, at) => at === 3),
    );
  });

  it('draws again only when what is shown changes, and clears for nothing', () => {
    const { layer, container, shown, requestRender, all } = fakeHost();
    // Nothing shown yet: nothing to clear.
    layer.update(null);
    expect(shown).toHaveLength(0);
    layer.update(marksOf(lions));
    layer.update(marksOf(lions));
    expect(shown).toHaveLength(1);
    layer.update(marksOf(cats, { key: 'cats:10:picked' }));
    expect(shown).toHaveLength(2);
    expect(container.dataset['lifeMarks']).toBe(String(cats.length));
    layer.update(null);
    expect(shown[2]).toBeNull();
    expect(container.dataset['lifeMarks']).toBe('off');
    expect(all('.life-mark, .life-callout')).toHaveLength(0);
    expect(all<SVGElement>('.life-lines line')).toHaveLength(0);
    expect(requestRender).toHaveBeenCalledTimes(3);
  });
});

describe('the kinds’ pictures round the globe', () => {
  it('makes one for each kind at the site it was found at most, hidden until placed', () => {
    const { layer, container, all } = fakeHost();
    layer.update(marksOf(lions));
    expect([...container.children].map((child) => child.getAttribute('class'))).toEqual([
      'life-lines',
      'empire-labels life-marks',
      'life-callouts',
    ]);
    const callouts = all<HTMLButtonElement>('.life-callouts > button.life-callout');
    expect(callouts).toHaveLength(1);
    const [callout] = callouts;
    expect(callout?.type).toBe('button');
    expect(callout?.className).toBe('life-callout is-found');
    expect(callout?.hidden).toBe(true);
    expect(callout?.title).toBe('Panthera: 16 finds');
    expect(callout?.querySelector('.life-callout-name')?.textContent).toBe('Panthera');
    const image = callout?.querySelector('img');
    expect(image?.className).toBe('life-silhouette');
    expect(image?.src).toBe(pictures.names['Panthera']?.silhouette?.src);
    expect(image?.alt).toBe('');
    expect(image?.width).toBe(34);
    expect(image?.referrerPolicy).toBe('no-referrer');
    const lines = all<SVGElement>('.life-lines line');
    expect(lines).toHaveLength(1);
    expect(lines[0]?.getAttribute('class')).toBe('life-line-to is-found');
    expect(lines[0]?.style.display).toBe('none');
  });

  it('shows a kind with no silhouette by its name alone', () => {
    const { layer, all } = fakeHost();
    layer.update(marksOf(lions, { silhouette: () => null }));
    const [callout] = all('.life-callout');
    expect(callout?.className).toBe('life-callout is-found is-plain');
    expect(callout?.querySelector('img')).toBeNull();
    expect(callout?.textContent).toBe('Panthera');
  });

  it('pictures the first sixteen kinds only, the most telling first', () => {
    const { layer, all } = fakeHost();
    const leads = cats.filter((mark) => mark.lead);
    expect(leads.length).toBeGreaterThan(16);
    layer.update(marksOf(cats));
    const callouts = all('.life-callout');
    expect(callouts).toHaveLength(16);
    expect(all<SVGElement>('.life-lines line')).toHaveLength(16);
    expect(callouts.map((callout) => callout.title)).toEqual(
      leads.slice(0, 16).map((mark) => mark.title),
    );
    expect(callouts[0]?.className).toContain('is-focus');
    // Some of the cats have a silhouette, some none.
    const plain = callouts.filter((callout) => callout.classList.contains('is-plain'));
    expect(plain.length).toBeGreaterThan(0);
    expect(plain.length).toBeLessThan(16);
  });

  it('picks the kind’s site when its picture is tapped, the tap kept from the globe', () => {
    const { layer, container, all } = fakeHost();
    const through = vi.fn();
    container.addEventListener('click', through);
    const drawn = marksOf(lions);
    layer.update(drawn);
    all('.life-callout')[0]?.click();
    expect(drawn.pick).toHaveBeenCalledExactlyOnceWith(lions[0]);
    expect(through).not.toHaveBeenCalled();
  });
});

describe('placing the pictures after each frame', () => {
  it('stands each picture outside the globe and draws its line from its dot’s middle', () => {
    const { layer, frame, all } = fakeHost();
    layer.update(marksOf(cats));
    frame();
    const callouts = all('.life-callout');
    const lines = all<SVGElement>('.life-lines line');
    expect(callouts.every((callout) => callout.hidden === false)).toBe(true);
    expect(lines.every((line) => line.style.display === '')).toBe(true);
    for (const callout of callouts) {
      expect(callout.style.transform).toMatch(/^translate\(\d+px, \d+px\)$/);
    }
    // No two pictures in the same place.
    expect(new Set(callouts.map((callout) => callout.style.transform)).size).toBe(16);
    // The first kind's dot is the first dot: its middle, in the globe's frame.
    const [line] = lines;
    expect(line?.getAttribute('x1')).toBe('306.0');
    expect(line?.getAttribute('y1')).toBe('206.0');
    const [x2, y2] = [Number(line?.getAttribute('x2')), Number(line?.getAttribute('y2'))];
    // The picture stands clear of the globe: further from its middle than the globe's edge.
    const globeRadius = FRAME.height / 2 / Math.tan((45 * Math.PI) / 360) / Math.sqrt(4.5 ** 2 - 1);
    expect(Math.hypot(x2 - FRAME.width / 2, y2 - FRAME.height / 2)).toBeGreaterThan(globeRadius);
    expect(callouts[0]?.style.transform).toBe(
      `translate(${String(Math.round(x2 - 38))}px, ${String(Math.round(y2 - 29))}px)`,
    );
  });

  it('hides the picture and line of a dot the globe has hidden, and places the rest', () => {
    const { layer, frame, all } = fakeHost();
    layer.update(marksOf(cats));
    frame();
    const leads = all('.life-mark').filter((_, at) => cats[at]?.lead === true);
    const [first, second, third] = leads;
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('too few dots');
    }
    // Behind the globe; not yet laid out; and taken off the page.
    first.hidden = true;
    vi.spyOn(second, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 0, 0));
    third.remove();
    frame(false);
    const callouts = all('.life-callout');
    const lines = all<SVGElement>('.life-lines line');
    expect(callouts.map((callout) => callout.hidden)).toEqual(callouts.map((_, at) => at < 3));
    expect(lines.map((line) => line.style.display)).toEqual(
      lines.map((_, at) => (at < 3 ? 'none' : '')),
    );
    // Shown again, its picture comes back.
    first.hidden = false;
    frame(false);
    expect(callouts[0]?.hidden).toBe(false);
    expect(lines[0]?.style.display).toBe('');
  });

  it('measures nothing while there are no pictures to place', () => {
    const { layer, frame, framed } = fakeHost();
    frame();
    layer.update(marksOf(lions.filter((mark) => !mark.lead)));
    frame();
    layer.update(null);
    frame();
    expect(framed).not.toHaveBeenCalled();
  });
});
