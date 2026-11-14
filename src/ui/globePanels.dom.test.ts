// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { joinGlobePanels } from './globePanels';

describe('the panels beside the globe', () => {
  it('Given two panels, Then they share one column, each in its order', () => {
    const container = document.createElement('div');
    const first = document.createElement('section');
    const second = document.createElement('section');
    joinGlobePanels(container, first, 2);
    joinGlobePanels(container, second, 1);
    const columns = container.querySelectorAll('.globe-panels');
    expect(columns).toHaveLength(1);
    expect([...(columns[0]?.children ?? [])]).toEqual([first, second]);
    expect([first.style.order, second.style.order]).toEqual(['2', '1']);
  });
});
