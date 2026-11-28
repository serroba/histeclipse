// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { historyView, type LossHistory } from './lossHistory';

const HISTORY: LossHistory = {
  title: 'Marine genera lost: here 76%, an ordinary stage 20%',
  stages: [
    { name: 'Older', base: 300, top: 250, lost: 0.2 },
    { name: 'Uncounted', base: 250, top: 200, lost: null },
    { name: 'Crisis', base: 200, top: 100, lost: 0.76 },
  ],
  marked: ['Crisis'],
  ends: ['300 Ma', '100 Ma'],
};

describe('historyView', () => {
  const root = historyView(HISTORY);
  const bars = [...root.querySelectorAll<HTMLElement>('.loss-history-bar')];

  it('says what it counts, for every reader, the bars only drawn', () => {
    expect(root.querySelector('figcaption')?.textContent).toBe(HISTORY.title);
    expect(root.querySelector('.loss-history-plot')?.getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelector('.loss-history-ends')?.textContent).toBe('300 Ma100 Ma');
  });

  it('draws each counted stage as wide as it was long, as tall as its share lost', () => {
    expect(bars).toHaveLength(2);
    expect(bars[0]?.style.left).toBe('0%');
    expect(bars[0]?.style.width).toBe('25%');
    expect(bars[0]?.style.height).toBe('20%');
    expect(bars[1]?.style.left).toBe('50%');
    expect(bars[1]?.style.width).toBe('50%');
    expect(bars[1]?.style.height).toBe('76%');
  });

  it('marks the extinction’s own stages', () => {
    expect(bars[0]?.classList.contains('loss-history-marked')).toBe(false);
    expect(bars[1]?.classList.contains('loss-history-marked')).toBe(true);
  });

  it('draws nothing where there are no stages', () => {
    const empty = historyView({ ...HISTORY, stages: [] });
    expect(empty.querySelectorAll('.loss-history-bar')).toHaveLength(0);
  });
});
