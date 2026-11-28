/**
 * An animal's story as a chart over its steps, oldest on the left: a row for each part of
 * today's world its kinds were found in, a thin row for each door between those lands (gold
 * where land joined them, pale where a shallow sea lay between), how warm it was where they lay
 * beside the globe's mean, and how many kinds were known. A tap on it goes to that step; a
 * playhead marks the step shown.
 */

import { element } from '../../ui/dom';
import type { DoorRow } from './doors';
import { LAND, SHELF, type DoorState } from './lifeDoors';
import type { Story, StoryStep } from './story';
import { counted } from './words';

const SVG = 'http://www.w3.org/2000/svg';

/** The regions' names, short, for the chart's rows. */
const SHORT: Readonly<Record<string, string>> = {
  'North America': 'N America',
  'South America': 'S America',
};

export interface StoryChart {
  readonly root: HTMLElement;
  /** Mark the step shown, by its place among the story's steps; none for -1. */
  mark(at: number): void;
}

function svg(tag: string, attributes: Readonly<Record<string, string>>): SVGElement {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

/** A line through the steps that have a value, lifted over those that do not. */
function linePath(
  steps: readonly StoryStep[],
  pick: (step: StoryStep) => number | null,
  x: (at: number) => number,
  y: (celsius: number) => number,
): string {
  let path = '';
  let pen = false;
  steps.forEach((step, at) => {
    const value = pick(step);
    if (value !== null) path += `${pen ? 'L' : 'M'}${x(at).toFixed(2)} ${y(value).toFixed(2)}`;
    pen = value !== null;
  });
  return path;
}

/** The two temperatures over the story's steps: where they lay, and the globe's mean. */
export function temperatureChart(steps: readonly StoryStep[]): SVGElement {
  const [width, height] = [100, 34];
  const values = steps.flatMap((step) => [step.celsius, step.globe]).filter((v) => v !== null);
  const low = Math.min(...values, 10);
  const high = Math.max(...values, 20);
  const x = (at: number): number => ((at + 0.5) / steps.length) * width;
  const y = (celsius: number): number =>
    height - 2 - ((celsius - low) / (high - low)) * (height - 4);
  const chart = svg('svg', {
    viewBox: `0 0 ${String(width)} ${String(height)}`,
    preserveAspectRatio: 'none',
    class: 'life-temperature',
    role: 'img',
    'aria-label': `Temperature where they were found and the globe’s mean, from ${String(Math.round(low))} to ${String(Math.round(high))} °C`,
  });
  chart.append(
    svg('path', { d: linePath(steps, (step) => step.globe, x, y), class: 'life-line is-globe' }),
    svg('path', { d: linePath(steps, (step) => step.celsius, x, y), class: 'life-line is-found' }),
    // A dot at each step with finds: a step standing alone has no line to show it.
    ...steps.flatMap((step, at) =>
      step.celsius === null
        ? []
        : [
            svg('circle', {
              cx: x(at).toFixed(2),
              cy: y(step.celsius).toFixed(2),
              r: '0.9',
              class: 'life-point',
            }),
          ],
    ),
  );
  return chart;
}

/** A row for each part of today's world with finds: a cell a step, stronger with more finds. */
function regionRows(story: Story): HTMLElement[] {
  const most = Math.max(1, ...story.steps.flatMap((step) => step.byRegion));
  return story.data.regions.flatMap((region, at) => {
    if (!story.steps.some((step) => (step.byRegion[at] ?? 0) > 0)) return [];
    const cells = story.steps.map((step) => {
      const finds = step.byRegion[at] ?? 0;
      const cell = element('i', { class: finds > 0 ? 'life-cell is-on' : 'life-cell' });
      if (finds > 0) {
        cell.style.opacity = String(0.35 + 0.65 * (Math.log1p(finds) / Math.log1p(most)));
        cell.title = `${region}, ${String(step.ma)} Ma: ${String(finds)} finds`;
      }
      return cell;
    });
    return [
      element('span', { class: 'life-row-name' }, SHORT[region] ?? region),
      element('span', { class: 'life-row' }, ...cells),
    ];
  });
}

const DOOR_CLASS: Readonly<Record<DoorState, string>> = {
  0: 'life-cell',
  [SHELF]: 'life-cell is-shelf',
  [LAND]: 'life-cell is-land',
};
const DOOR_SAID: Readonly<Record<DoorState, string>> = {
  0: 'sea between',
  [SHELF]: 'a shallow sea between',
  [LAND]: 'joined by land',
};

/** A thin row for each door between the lands the story has finds on. */
function doorRowsOf(story: Story, rows: readonly DoorRow[]): HTMLElement[] {
  if (rows.length === 0) return [];
  return [
    element('span', { class: 'life-row-name is-heading' }, 'Doors'),
    element('span', { class: 'life-row-key' }, 'joined by land · shallow sea between'),
    ...rows.flatMap((row) => [
      element(
        'span',
        { class: 'life-row-name is-door' },
        row.name.replace('North America', 'N Am').replace('South America', 'S Am'),
      ),
      element(
        'span',
        { class: 'life-row is-door' },
        ...row.states.map((state, at) => {
          const cell = element('i', { class: DOOR_CLASS[state] });
          cell.title = `${row.name}, ${String(story.steps[at]?.ma ?? 0)} Ma: ${DOOR_SAID[state]}, on the elevation maps`;
          return cell;
        }),
      ),
    ]),
  ];
}

/** How many kinds were known at each step, as bars. */
function kindsRow(story: Story): HTMLElement {
  const most = Math.max(1, ...story.steps.map((step) => step.kinds));
  return element(
    'span',
    { class: 'life-row is-kinds' },
    ...story.steps.map((step) => {
      const bar = element('i', { class: 'life-bar' });
      bar.style.height = `${String(Math.max(4, (step.kinds / most) * 100))}%`;
      bar.title = `${String(step.ma)} Ma: ${counted(step.kinds, 'kind')} known`;
      return bar;
    }),
  );
}

/** The step a tap at `clientX` falls on, given where the rows lie; null outside them. */
export function stepUnder(
  clientX: number,
  box: { readonly left: number; readonly width: number },
  steps: number,
): number | null {
  const share = (clientX - box.left) / box.width;
  if (!(share >= 0 && share <= 1) || steps === 0) return null;
  return Math.min(steps - 1, Math.floor(share * steps));
}

export function storyChart(
  story: Story,
  doors: readonly DoorRow[],
  goTo: (ma: number) => void,
): StoryChart {
  const temperatures = element('span', { class: 'life-row is-temperature' });
  temperatures.append(temperatureChart(story.steps));
  const [oldest] = story.steps;
  const youngest = story.steps.at(-1);
  const strip = element(
    'div',
    { class: 'life-strip' },
    ...regionRows(story),
    ...doorRowsOf(story, doors),
    element(
      'span',
      { class: 'life-row-name' },
      element('span', { class: 'life-key is-found' }, '°C there'),
      element('span', { class: 'life-key is-globe' }, 'globe'),
    ),
    temperatures,
    element('span', { class: 'life-row-name' }, 'Kinds'),
    kindsRow(story),
    element('span', {}),
    element(
      'span',
      { class: 'life-axis' },
      element('span', {}, `${String(oldest?.ma ?? 0)} Ma`),
      element('span', {}, youngest?.ma === 0 ? 'today' : `${String(youngest?.ma ?? 0)} Ma`),
    ),
  );
  strip.addEventListener('click', (event) => {
    // Every row spans the same steps: the temperatures' is always there to measure by.
    const at = stepUnder(event.clientX, temperatures.getBoundingClientRect(), story.steps.length);
    const step = at === null ? undefined : story.steps[at];
    if (step !== undefined) goTo(step.ma);
  });
  const playhead = element('i', { class: 'life-playhead' });
  playhead.hidden = true;
  return {
    root: element('div', { class: 'life-chart' }, strip, playhead),
    mark(at) {
      playhead.hidden = at < 0;
      if (at >= 0) {
        playhead.style.setProperty('--life-at', String((at + 0.5) / story.steps.length));
      }
    },
  };
}
