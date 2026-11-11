/**
 * The Holocene chapter's chart (#453): temperature from 800,000 years ago to now, drawn left to
 * right as it plays. The ice ages swing; then, for 10,000 years, global temperature keeps to a
 * narrow band, the Holocene corridor, in which farming and cities arose; then it climbs out.
 *
 * The site's own drawing of the records the Planetary Health Check 2026's Figure 1 cites. The
 * Antarctic core is drawn faint and named as Antarctic: it swings about twice as far as the
 * globe. SVG drawn at the stage's own size, so its words stay legible on a phone. DOM glue,
 * covered by the Playwright suite; the scales and numbers are in `data/holoceneTemperature.ts`.
 */

import {
  bandPath,
  completePoints,
  CORRIDOR_FROM,
  corridorOf,
  latestYear,
  linePath,
  PANELS,
  xOf,
  yOf,
  type HoloceneTemperature,
  type SeriesId,
} from '../data/holoceneTemperature';
import type { StoryScene } from './storyScene';
import './holoceneChart.css';

/** How long the line takes to cross the chart, ms. */
const DRAW_MS = 9000;
/** The Holocene's start, 11,700 years before 2000. */
const HOLOCENE_STARTS = -9700;
const MARGIN = { top: 26, right: 14, bottom: 34, left: 40 } as const;

const STYLE: Readonly<Record<SeriesId, { colour: string; label: string }>> = {
  epica: { colour: '#6f7f99', label: 'Antarctica (ice core)' },
  lgmr: { colour: '#7fb8ff', label: 'Global (Osman 2021)' },
  pages2k: { colour: '#c9a6ff', label: 'Global (PAGES 2k)' },
  hadcrut5: { colour: '#ff8a3d', label: 'Global, measured' },
};

/** The x axis' marks: a year, what it is called, and whether only a wide chart has room. */
const TICKS: readonly (readonly [number, string, boolean?])[] = [
  [-798_050, '800k years ago'],
  [-398_050, '400k', true],
  [-18_050, '20k'],
  [-8050, '10k'],
  [1, '1 CE'],
  [1850, '1850'],
  [2000, '2000'],
];

const SVG = 'http://www.w3.org/2000/svg';

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Readonly<Record<string, string | number>>,
  text?: string,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
const within = (t: number, from: number, to: number) =>
  Math.min(1, Math.max(0, (t - from) / (to - from)));

export function createHoloceneChart(
  container: HTMLElement,
  data: HoloceneTemperature,
): StoryScene<'holocene'> {
  const corridor = corridorOf(data);
  const latest = latestYear(data);
  const root = svg('svg', {
    class: 'holocene-chart',
    role: 'img',
    'aria-label': `Temperature over 800,000 years. The ice ages swing by about 7 °C globally; for the 10,000 years before industry it kept within ${(corridor.high - corridor.low).toFixed(1)} °C; in ${String(latest.year)} it was ${latest.celsius.toFixed(1)} °C above 1850–1900.`,
  });
  container.append(root);

  let progress = 0;
  let clock = 0;
  let playing = true;
  let last: number | null = null;
  let frame = 0;
  let parts: { clip: SVGRectElement; corridor: SVGGElement; now: SVGGElement } | null = null;
  let size = { width: 0, height: 0 };

  /** Lay the chart out at the stage's size. */
  function draw(): void {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;
    size = { width, height };
    root.setAttribute('viewBox', `0 0 ${String(width)} ${String(height)}`);
    const w = width - MARGIN.left - MARGIN.right;
    const h = height - MARGIN.top - MARGIN.bottom;
    const x = (year: number) => xOf(year) * w;
    const y = (celsius: number) => yOf(celsius) * h;
    const plot = svg('g', { transform: `translate(${String(MARGIN.left)} ${String(MARGIN.top)})` });

    for (const celsius of [-8, -6, -4, -2, 0, 2, 4]) {
      plot.append(
        svg('line', {
          class: celsius === 0 ? 'axis is-zero' : 'axis',
          x1: 0,
          x2: w,
          y1: y(celsius),
          y2: y(celsius),
        }),
        svg(
          'text',
          { class: 'tick', x: -6, y: y(celsius) + 4, 'text-anchor': 'end' },
          `${celsius > 0 ? '+' : ''}${String(celsius)}`,
        ),
      );
    }
    plot.append(svg('text', { class: 'tick', x: -6, y: -10, 'text-anchor': 'end' }, '°C'));
    let left = 0;
    for (const panel of PANELS) {
      if (left > 0)
        plot.append(svg('line', { class: 'panel-edge', x1: left * w, x2: left * w, y1: 0, y2: h }));
      plot.append(
        svg(
          'text',
          { class: 'panel-name', x: (left + panel.share / 2) * w, y: -10, 'text-anchor': 'middle' },
          panel.name,
        ),
      );
      left += panel.share;
    }
    for (const [year, name, wide] of TICKS) {
      if (wide === true && w < 520) continue;
      plot.append(
        svg(
          'text',
          {
            class: 'tick',
            x: x(year),
            y: h + 16,
            'text-anchor': year < -700_000 ? 'start' : 'middle',
          },
          name,
        ),
      );
    }

    const corridorBand = svg('g', { class: 'corridor', 'data-testid': 'holocene-corridor' });
    corridorBand.append(
      svg('rect', {
        x: x(CORRIDOR_FROM),
        width: w - x(CORRIDOR_FROM),
        y: y(corridor.high),
        height: y(corridor.low) - y(corridor.high),
      }),
      // Under the band: the lines run along its top.
      svg('text', { x: x(CORRIDOR_FROM) + 4, y: y(corridor.low) + 14 }, 'Holocene corridor'),
    );
    plot.append(
      corridorBand,
      svg('line', {
        class: 'holocene-start',
        x1: x(HOLOCENE_STARTS),
        x2: x(HOLOCENE_STARTS),
        y1: 0,
        y2: h,
      }),
    );

    const clipId = `holocene-clip-${String(Math.random()).slice(2)}`;
    const clip = svg('rect', { x: 0, y: -MARGIN.top, height: height, width: 0 });
    const clipPath = svg('clipPath', { id: clipId });
    clipPath.append(clip);
    const lines = svg('g', { 'clip-path': `url(#${clipId})` });
    for (const series of data.series) {
      const { colour } = STYLE[series.id];
      const points = completePoints(series);
      const band = bandPath(points, w, h);
      if (band !== '') lines.append(svg('path', { class: 'range', d: band, fill: colour }));
      lines.append(
        svg('path', {
          class: `line is-${series.scope}`,
          d: linePath(points, w, h),
          stroke: colour,
          'data-series': series.id,
        }),
      );
    }
    const now = svg('g', { class: 'now' });
    now.append(
      svg('circle', { cx: x(latest.year), cy: y(latest.celsius), r: 4 }),
      svg(
        'text',
        // Above and to the left of the point, which is at the chart's right edge.
        { x: x(latest.year), y: y(latest.celsius) - 10, 'text-anchor': 'end' },
        `${String(latest.year)}: +${latest.celsius.toFixed(1)} °C`,
      ),
    );
    const defs = svg('defs', {});
    defs.append(clipPath);
    plot.append(defs, lines, now);

    // The key, low on the right: after the ice ages no line comes down that far.
    const legend = svg('g', {
      class: 'legend',
      transform: `translate(${String(w)} ${String(y(-6))})`,
    });
    data.series.forEach((series, index) => {
      const { colour, label } = STYLE[series.id];
      legend.append(
        svg('line', {
          x1: -14,
          x2: 0,
          y1: index * 14,
          y2: index * 14,
          stroke: colour,
          class: `line is-${series.scope}`,
        }),
        svg('text', { x: -18, y: index * 14 + 4, 'text-anchor': 'end' }, label),
      );
    });
    plot.append(legend);
    root.replaceChildren(plot);
    parts = { clip, corridor: corridorBand, now };
    show();
    container.dataset['rendered'] = 'true';
  }

  /** Show the chart as far as `progress` has drawn it. */
  function show(): void {
    if (parts === null) return;
    const w = size.width - MARGIN.left - MARGIN.right;
    const reached = ease(progress);
    parts.clip.setAttribute('width', String(reached * w + 2));
    // The corridor shows once the line has come into the Holocene; today once the line is there.
    parts.corridor.style.opacity = String(within(reached, xOf(HOLOCENE_STARTS), xOf(-3000)));
    parts.now.style.opacity = String(within(reached, 0.995, 1));
    container.dataset['complete'] = String(progress >= 1);
  }

  function tick(time: number): void {
    frame = 0;
    if (last !== null && playing) clock += time - last;
    last = time;
    progress = Math.min(1, clock / DRAW_MS);
    show();
    if (playing && progress < 1) frame = requestAnimationFrame(tick);
    else if (progress >= 1) {
      playing = false;
      container.dataset['playing'] = 'false';
    }
  }

  function run(): void {
    if (frame === 0) {
      last = null;
      frame = requestAnimationFrame(tick);
    }
  }

  const resized = new ResizeObserver(() => {
    if (container.clientWidth !== size.width || container.clientHeight !== size.height) draw();
  });
  resized.observe(container);
  container.dataset['chapter'] = 'holocene';
  draw();
  run();

  return {
    setChapter() {
      // One chapter: nothing to turn to.
    },
    setPlaying(next) {
      playing = next && progress < 1;
      container.dataset['playing'] = String(playing);
      if (playing) run();
    },
    restart() {
      clock = 0;
      progress = 0;
      playing = true;
      container.dataset['playing'] = 'true';
      show();
      run();
    },
    settle() {
      clock = DRAW_MS;
      progress = 1;
      playing = false;
      container.dataset['playing'] = 'false';
      show();
    },
    dispose() {
      cancelAnimationFrame(frame);
      frame = 0;
      resized.disconnect();
      root.remove();
      const { dataset } = container;
      delete dataset['rendered'];
      delete dataset['complete'];
      delete dataset['playing'];
      delete dataset['chapter'];
    },
  };
}
