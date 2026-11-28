/**
 * Beside the globe while Temperature is on over the ice ages (#434, #453): global temperature
 * over 800,000 years, the ice ages' swings and then the Holocene corridor, with the moment shown
 * marked. The same chart the planetary boundaries' story opens on, here following the view's
 * time instead of playing on its own. It is a slider too, as in the story: dragged, or stepped
 * with the arrow keys, it takes the view to that moment, to the thousand years deep time keeps.
 * The chart's code loads the first time the panel shows, not with the site (#220). It sits in
 * deep time's bar, above the slider, at the size the story draws it, with its key (#434).
 */

import type { HoloceneTemperature } from '../../data/holoceneTemperature';
import type { createHoloceneChart } from '../../story/holoceneChart';
import { element } from '../../ui/dom';
import './holocenePanel.css';

export interface HoloceneView {
  readonly data: HoloceneTemperature;
  /** The year shown, astronomical. */
  readonly year: number;
  /** Draw on from there to the latest measured year, as play reaching today asks (#1276). */
  readonly drawOn?: boolean;
}

/** What the panel does: show a view, or none; and go. */
export interface HoloceneChartPanel {
  update(view: HoloceneView | null): void;
  dispose(): void;
}

/** The panel, in `slot`, with what moving its cursor does; null takes it away. */
export function holocenePanel(
  slot: HTMLElement,
  moveTo: (year: number) => void,
): HoloceneChartPanel {
  const stage = element('div', {
    class: 'holocene-panel-chart',
    'data-testid': 'holocene-panel',
  });
  const root = element(
    'figure',
    { class: 'holocene-panel', 'aria-label': 'Temperature over 800,000 years', hidden: '' },
    element(
      'figcaption',
      {},
      'Global temperature over 800,000 years, against 1850–1900. Drag along it to go there: the globe shows how much warmer or colder each place was than today.',
    ),
    stage,
  );
  slot.append(root);
  let chart: ReturnType<typeof createHoloceneChart> | null = null;
  let loading = false;
  let disposed = false;
  // The view asked for last: the chart, once loaded, starts there.
  let wanted: HoloceneView | null = null;
  // While the view holds the chart, the year it reports back is only that hold's echo.
  let holding = false;
  function draw(view: HoloceneView): void {
    if (chart === null) return;
    holding = true;
    chart.holdAt(view.year);
    holding = false;
    if (view.drawOn === true) chart.setPlaying(true);
  }
  function load(data: HoloceneTemperature): void {
    if (loading) return;
    loading = true;
    void import('../../story/holoceneChart').then(
      ({ createHoloceneChart }) => {
        if (disposed) return;
        // Made held: drawn, it names its first year, which is not the reader's either.
        holding = true;
        chart = createHoloceneChart(stage, data, (year) => {
          if (!holding) moveTo(year);
        });
        holding = false;
        if (wanted !== null) draw(wanted);
      },
      () => {
        // Asked for again by the next view shown.
        loading = false;
      },
    );
  }
  return {
    update(view) {
      root.hidden = view === null;
      wanted = view;
      if (view === null) return;
      if (chart === null) load(view.data);
      else draw(view);
    },
    dispose() {
      disposed = true;
      chart?.dispose();
      root.remove();
    },
  };
}
