// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { leftText, lossDone, lossView, type LossGauge } from './lossGauge';

const GAUGE: LossGauge = {
  what: 'Marine genera',
  lost: [0.38, 0.4],
  pulses: [
    { from: 0, to: 100, share: 0.75 },
    { from: 200, to: 200, share: 0.25 },
  ],
  says: 'Lost: 38–40%.',
};

describe('lossDone', () => {
  it('rises over each pulse by its share, and holds between them', () => {
    expect(lossDone(GAUGE.pulses, -10)).toBe(0);
    expect(lossDone(GAUGE.pulses, 50)).toBeCloseTo(0.375);
    expect(lossDone(GAUGE.pulses, 150)).toBeCloseTo(0.75);
    // A pulse with no length is all at once.
    expect(lossDone(GAUGE.pulses, 199)).toBeCloseTo(0.75);
    expect(lossDone(GAUGE.pulses, 200)).toBe(1);
    expect(lossDone(GAUGE.pulses, 1e9)).toBe(1);
  });
});

describe('leftText', () => {
  it('says the share left as a range, or one number where they round alike', () => {
    expect(leftText([0.38, 0.4], 1)).toBe('60–62%');
    expect(leftText([0.618, 0.624], 1)).toBe('38%');
    expect(leftText([0.38, 0.4], 0)).toBe('100%');
  });
});

describe('lossView', () => {
  it('shows the life left falling as the moment moves on', () => {
    const view = lossView(GAUGE);
    view.at(0);
    expect(view.root.querySelector('.loss-gauge-label')?.textContent).toBe(
      'Marine genera left: 100%',
    );
    view.at(1000);
    expect(view.root.querySelector('.loss-gauge-label')?.textContent).toBe(
      'Marine genera left: 60–62%',
    );
    const sure = view.root.querySelector<HTMLElement>('.loss-gauge-sure');
    const maybe = view.root.querySelector<HTMLElement>('.loss-gauge-maybe');
    expect(Number.parseFloat(sure?.style.width ?? '')).toBeCloseTo(60);
    expect(Number.parseFloat(maybe?.style.width ?? '')).toBeCloseTo(2);
    expect(view.root.querySelector('.loss-gauge-says')?.textContent).toBe('Lost: 38–40%.');
  });
});
