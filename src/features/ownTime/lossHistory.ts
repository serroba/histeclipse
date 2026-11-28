/**
 * An extinction against the whole record (#1269): a strip of bars under its gauge, one for each
 * stage of the Phanerozoic, as wide as the stage was long and as tall as the share of its life
 * lost, the extinction's own stages marked. It shows how far a mass extinction stands above the
 * losses of an ordinary stage. Its words say whose counts and how they are made.
 */

import { element } from '../../ui/dom';

/** A stage, Ma, and the share of its life lost, 0–1, where it can be counted. */
interface HistoryStage {
  readonly name: string;
  readonly base: number;
  readonly top: number;
  readonly lost: number | null;
}

export interface LossHistory {
  /** What the bars count, and the extinction's share against an ordinary stage's. */
  readonly title: string;
  /** The stages, oldest first. */
  readonly stages: readonly HistoryStage[];
  /** The extinction's own stages, by name. */
  readonly marked: readonly string[];
  /** The oldest and youngest ends of the strip, as said under it: "539 Ma". */
  readonly ends: readonly [string, string];
}

/** Percent of `span` from `from`. */
const percent = (part: number, span: number) => `${String((100 * part) / span)}%`;

/** The strip for `history`. */
export function historyView(history: LossHistory): HTMLElement {
  const { stages, marked } = history;
  const oldest = stages[0]?.base ?? 0;
  const span = oldest - (stages.at(-1)?.top ?? 0) || 1;
  const bars = stages.flatMap((stage) => {
    if (stage.lost === null) return [];
    const bar = element('span', {
      class: marked.includes(stage.name)
        ? 'loss-history-bar loss-history-marked'
        : 'loss-history-bar',
    });
    bar.style.left = percent(oldest - stage.base, span);
    bar.style.width = percent(stage.base - stage.top, span);
    bar.style.height = percent(stage.lost, 1);
    return [bar];
  });
  return element(
    'figure',
    { class: 'loss-history' },
    element('figcaption', { class: 'loss-history-title' }, history.title),
    element('div', { class: 'loss-history-plot', 'aria-hidden': 'true' }, ...bars),
    element(
      'div',
      { class: 'loss-history-ends', 'aria-hidden': 'true' },
      element('span', {}, history.ends[0]),
      element('span', {}, history.ends[1]),
    ),
  );
}
