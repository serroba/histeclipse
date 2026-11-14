// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { defaultViewState } from '../../state/viewState';
import { mountExplore } from '.';

describe('Explore on the page', () => {
  it('Given a destination picked, Then its anchor opens; Search opens Search; the view marks the one arrived at', () => {
    const openAnchor = vi.fn();
    const open = vi.fn();
    const part = mountExplore({ openAnchor, search: { open } });
    document.body.append(part.button, part.dialog);
    part.button.click();
    document.querySelector<HTMLButtonElement>('[data-destination="moon-landings"]')?.click();
    const [[anchor]] = openAnchor.mock.calls as [[{ body: string; view: string }]];
    expect(anchor.body).toBe('moon');
    expect(anchor.view).toContain('explore=moon-landings');
    part.show({ ...defaultViewState(new Date()), explore: 'moon-landings' });
    expect(
      document.querySelector('[data-destination="moon-landings"]')?.getAttribute('aria-current'),
    ).toBe('true');
    document.querySelector<HTMLButtonElement>('.explore-search')?.click();
    expect(open).toHaveBeenCalledOnce();
  });
});
