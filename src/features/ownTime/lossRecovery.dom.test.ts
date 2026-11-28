// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { lossView } from './lossGauge';
import { recoveryView, type LossRecovery } from './lossRecovery';

const RECOVERY: LossRecovery = {
  title: 'How long life took to come back, by what each study measured',
  rows: [
    { what: 'Ammonoids', took: 'in under 2 million years', whose: 'Brayard et al. 2009' },
    { what: 'Marine genera', took: 'about 5 million years', whose: 'Song et al. 2018' },
  ],
};

describe('recoveryView', () => {
  const root = recoveryView(RECOVERY);

  it('lists each study’s figure in words, whose beside it', () => {
    expect(root.querySelector('figcaption')?.textContent).toBe(RECOVERY.title);
    expect([...root.querySelectorAll('li')].map((row) => row.textContent)).toEqual([
      'Ammonoids: in under 2 million years (Brayard et al. 2009)',
      'Marine genera: about 5 million years (Song et al. 2018)',
    ]);
  });

  it('rides on the gauge after its groups, only where a gauge has one', () => {
    const gauge = { what: 'Marine genera', lost: [0.5, 0.6] as const, pulses: [], says: 'Said.' };
    expect(lossView(gauge).root.querySelector('.loss-recoveries')).toBeNull();
    const shown = lossView({ ...gauge, recovery: RECOVERY }).root;
    expect(shown.querySelector('.loss-recoveries figcaption')?.textContent).toBe(RECOVERY.title);
  });
});
