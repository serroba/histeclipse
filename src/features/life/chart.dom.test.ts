// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { parseLife, type LifeData } from '../../data/lifeStories';
import { stepUnder, storyChart, temperatureChart } from './chart';
import { doorRows, type DoorRow } from './doors';
import { loadLifeDoors } from './lifeDoors';
import { storyOf, type Story, type StoryStep } from './story';

const FOLDER = join(import.meta.dirname, '../../../public/data/life-stories');
const text = (name: string): string => readFileSync(join(FOLDER, `${name}.json`), 'utf8');
const mammals = parseLife(JSON.parse(text('mammals')));
const dinosaurs = parseLife(JSON.parse(text('dinosaurs')));
const doors = await loadLifeDoors('doors.json', () => Promise.resolve(new Response(text('doors'))));

function told(data: LifeData, clade: string): Story {
  const pbdb = data.nodes.find((node) => node.name === clade)?.pbdb ?? -1;
  const story = storyOf(data, pbdb, null);
  if (story === null) throw new Error(`no story of ${clade}`);
  return story;
}

/** The cats: seven steps from 30 Ma to today, found on five of today's continents. */
const cats = told(mammals, 'Felidae');
const tyrannosaurs = told(dinosaurs, 'Tyrannosauridae');

const step = (ma: number, celsius: number | null, globe: number | null): StoryStep => ({
  ma,
  finds: celsius === null ? 0 : 3,
  byRegion: [],
  kinds: 1,
  began: [],
  ended: [],
  celsius,
  globe,
});

const texts = (root: Element, selector: string): (string | null)[] =>
  [...root.querySelectorAll(selector)].map((each) => each.textContent);

/** Lay the chart's rows out from 100 px to 800 px across, as a page would. */
function laidOut(root: HTMLElement): void {
  for (const row of root.querySelectorAll('.life-row')) {
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 0, 700, 12));
  }
}

function tap(root: HTMLElement, clientX: number): void {
  root
    .querySelector('.life-strip')
    ?.dispatchEvent(new MouseEvent('click', { clientX, bubbles: true }));
}

describe('the step under a tap on the chart', () => {
  it('is the step whose share of the rows’ width the tap falls in', () => {
    const box = { left: 100, width: 700 };
    expect(stepUnder(100, box, 7)).toBe(0);
    expect(stepUnder(199, box, 7)).toBe(0);
    expect(stepUnder(201, box, 7)).toBe(1);
    expect(stepUnder(450, box, 7)).toBe(3);
    // The rows' right edge is still the last step.
    expect(stepUnder(800, box, 7)).toBe(6);
  });

  it('is none outside the rows, with no steps, or before the rows have a width', () => {
    const box = { left: 100, width: 700 };
    expect(stepUnder(99, box, 7)).toBeNull();
    expect(stepUnder(801, box, 7)).toBeNull();
    expect(stepUnder(450, box, 0)).toBeNull();
    expect(stepUnder(0, { left: 0, width: 0 }, 7)).toBeNull();
  });
});

describe('the two temperatures over a story’s steps', () => {
  it('draws where they lay and the globe’s mean, and says the range it spans', () => {
    const chart = temperatureChart([step(10, 24, 16), step(5, 26, 15), step(0, 22, 14)]);
    expect(chart.getAttribute('class')).toBe('life-temperature');
    expect(chart.getAttribute('viewBox')).toBe('0 0 100 34');
    expect(chart.getAttribute('aria-label')).toBe(
      'Temperature where they were found and the globe’s mean, from 10 to 26 °C',
    );
    const [globe, found] = [...chart.querySelectorAll('path')];
    expect(globe?.getAttribute('class')).toBe('life-line is-globe');
    expect(found?.getAttribute('class')).toBe('life-line is-found');
    // One line through all three steps: the warmest at the top, 2 units in.
    expect(found?.getAttribute('d')).toBe('M16.67 5.75L50.00 2.00L83.33 9.50');
    expect(chart.querySelectorAll('circle.life-point')).toHaveLength(3);
  });

  it('lifts the line over a step with no finds, and dots only the steps with finds', () => {
    const chart = temperatureChart([
      step(15, 12, 18),
      step(10, null, null),
      step(5, 14, 16),
      step(0, 15, 15),
    ]);
    const [globe, found] = [...chart.querySelectorAll('path')];
    expect(found?.getAttribute('d')).toMatch(/^M[\d. ]+M[\d. ]+L[\d. ]+$/);
    expect(globe?.getAttribute('d')).toMatch(/^M[\d. ]+M[\d. ]+L[\d. ]+$/);
    expect(chart.querySelectorAll('circle')).toHaveLength(3);
    // Never a narrower span than 10 to 20 °C, so a flat story is not drawn as a cliff.
    expect(chart.getAttribute('aria-label')).toContain('from 10 to 20 °C');
  });
});

describe('a story’s chart', () => {
  it('has a row for each part of today’s world with finds, a cell a step, stronger with more', () => {
    const { root } = storyChart(cats, [], vi.fn());
    expect(root.className).toBe('life-chart');
    const names = texts(root, '.life-row-name');
    expect(names.slice(0, 5)).toEqual(['N America', 'S America', 'Europe', 'Africa', 'Asia']);
    // Nothing of the cats in Oceania or Antarctica: no row.
    expect(names).not.toContain('Oceania');
    const [northAmerica] = [...root.querySelectorAll('.life-row')];
    const cells = [...(northAmerica?.querySelectorAll<HTMLElement>('i') ?? [])];
    expect(cells.map((cell) => cell.className)).toEqual([
      'life-cell',
      'life-cell',
      'life-cell',
      'life-cell is-on',
      'life-cell is-on',
      'life-cell is-on',
      'life-cell is-on',
    ]);
    expect(cells[0]?.title).toBe('');
    expect(cells[3]?.title).toBe('North America, 15 Ma: 36 finds');
    const opacity = cells.slice(3).map((cell) => Number(cell.style.opacity));
    expect(opacity.every((each) => each > 0.35 && each <= 1)).toBe(true);
    expect(opacity[2]).toBeGreaterThan(opacity[1] ?? 1);
  });

  it('has the temperatures, the kinds known as bars, and an axis from its oldest finds to today', () => {
    const { root } = storyChart(cats, [], vi.fn());
    expect(root.querySelector('.life-row.is-temperature svg.life-temperature')).not.toBeNull();
    expect(texts(root, '.life-key')).toEqual(['°C there', 'globe']);
    const bars = [...root.querySelectorAll<HTMLElement>('.life-row.is-kinds .life-bar')];
    expect(bars.map((bar) => bar.title)).toEqual([
      '30 Ma: 1 kind known',
      '25 Ma: 1 kind known',
      '20 Ma: 5 kinds known',
      '15 Ma: 9 kinds known',
      '10 Ma: 20 kinds known',
      '5 Ma: 30 kinds known',
      '0 Ma: 19 kinds known',
    ]);
    // The most kinds fill the row; the fewest still show.
    expect(bars[5]?.style.height).toBe('100%');
    expect(bars[0]?.style.height).toBe('4%');
    expect(texts(root, '.life-axis span')).toEqual(['30 Ma', 'today']);
    expect(root.querySelector('.life-row-name.is-heading')).toBeNull();
  });

  it('ends its axis at the last finds of a lineage with no living kind', () => {
    const { root } = storyChart(tyrannosaurs, [], vi.fn());
    expect(texts(root, '.life-axis span')).toEqual(['85 Ma', '70 Ma']);
  });

  it('has a thin row for each door between its lands, each cell saying how the door stood', () => {
    const { root } = storyChart(cats, doorRows(cats, doors), vi.fn());
    expect(root.querySelector('.life-row-name.is-heading')?.textContent).toBe('Doors');
    expect(root.querySelector('.life-row-key')?.textContent).toBe(
      'joined by land · shallow sea between',
    );
    expect(texts(root, '.life-row-name.is-door')).toEqual([
      'N Am – S Am',
      'N Am – Asia',
      'Europe – Africa',
      'Europe – Asia',
      'Africa – Asia',
    ]);
    const [panama] = [...root.querySelectorAll('.life-row.is-door')];
    const cells = [...(panama?.querySelectorAll<HTMLElement>('i') ?? [])];
    expect(cells.map((cell) => cell.className)).toEqual([
      'life-cell',
      'life-cell',
      'life-cell',
      'life-cell',
      'life-cell is-shelf',
      'life-cell is-land',
      'life-cell is-land',
    ]);
    expect(cells.slice(3, 6).map((cell) => cell.title)).toEqual([
      'North America – South America, 15 Ma: sea between, on the elevation maps',
      'North America – South America, 10 Ma: a shallow sea between, on the elevation maps',
      'North America – South America, 5 Ma: joined by land, on the elevation maps',
    ]);
  });

  it('goes to the step a tap on its rows falls on, and nowhere for a tap beside them', () => {
    const goTo = vi.fn();
    const { root } = storyChart(cats, [], goTo);
    laidOut(root);
    tap(root, 450);
    expect(goTo).toHaveBeenLastCalledWith(15);
    tap(root, 790);
    expect(goTo).toHaveBeenLastCalledWith(0);
    tap(root, 101);
    expect(goTo).toHaveBeenLastCalledWith(30);
    expect(goTo).toHaveBeenCalledTimes(3);
    // On the rows' names, left of the rows.
    tap(root, 40);
    expect(goTo).toHaveBeenCalledTimes(3);
  });

  it('marks the step shown with a playhead at its middle, and none outside the story', () => {
    const chart = storyChart(cats, [], vi.fn());
    const playhead = chart.root.querySelector<HTMLElement>('.life-playhead');
    expect(playhead?.hidden).toBe(true);
    chart.mark(3);
    expect(playhead?.hidden).toBe(false);
    expect(playhead?.style.getPropertyValue('--life-at')).toBe(String(3.5 / 7));
    chart.mark(-1);
    expect(playhead?.hidden).toBe(true);
    // Hidden, it keeps where it last stood.
    expect(playhead?.style.getPropertyValue('--life-at')).toBe(String(3.5 / 7));
    chart.mark(0);
    expect(playhead?.style.getPropertyValue('--life-at')).toBe(String(0.5 / 7));
  });
});

describe('a chart of a story cut short', () => {
  it('draws a story with no steps as empty rows, and a tap on it goes nowhere', () => {
    const goTo = vi.fn();
    const { root } = storyChart({ ...cats, steps: [] }, [], goTo);
    expect(texts(root, '.life-axis span')).toEqual(['0 Ma', '0 Ma']);
    expect(root.querySelectorAll('.life-cell')).toHaveLength(0);
    laidOut(root);
    tap(root, 450);
    expect(goTo).not.toHaveBeenCalled();
  });

  it('reads a region a step has no count for as no finds, and a door’s state past the steps at 0 Ma', () => {
    // Steps as an older file might give them: fewer regions counted than the file names.
    const steps = cats.steps
      .slice(-2)
      .map((each, at) => ({ ...each, byRegion: at === 0 ? [4, 3] : [4] }));
    const [door] = doors.doors;
    if (door === undefined) throw new Error('no doors');
    const row: DoorRow = { door, name: 'North America – Asia', states: [2, 1, 0] };
    const { root } = storyChart({ ...cats, steps }, [row], vi.fn());
    expect(texts(root, '.life-row-name').slice(0, 3)).toEqual(['N America', 'S America', 'Doors']);
    const southAmerica = [...root.querySelectorAll('.life-row')][1];
    expect([...(southAmerica?.children ?? [])].map((cell) => cell.className)).toEqual([
      'life-cell is-on',
      'life-cell',
    ]);
    const titles = [...root.querySelectorAll<HTMLElement>('.life-row.is-door i')].map(
      (cell) => cell.title,
    );
    expect(titles).toEqual([
      'North America – Asia, 5 Ma: joined by land, on the elevation maps',
      'North America – Asia, 0 Ma: a shallow sea between, on the elevation maps',
      'North America – Asia, 0 Ma: sea between, on the elevation maps',
    ]);
  });
});
