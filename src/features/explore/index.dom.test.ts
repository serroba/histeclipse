// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { defaultViewState } from '../../state/viewState';
import { mountExplore } from '.';

describe('Explore on the page', () => {
  it('Given a destination picked, Then its anchor opens; Search opens Search; the view marks the one arrived at', () => {
    const openAnchor = vi.fn();
    const query = vi.fn();
    const open = vi.fn();
    const part = mountExplore({ opener: { anchor: openAnchor, query }, search: { open } });
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

  it('Given a reader who arrived at Human origins and then went to today, When they fit the topic, Then only its time comes back', () => {
    const query = vi.fn<(change: (current: string) => string) => void>();
    const part = mountExplore({ opener: { anchor: vi.fn(), query }, search: { open: vi.fn() } });
    document.body.replaceChildren(part.context);
    part.show({ ...defaultViewState(new Date()), explore: 'human-origins' });
    const fit = part.context.querySelector<HTMLButtonElement>('.explore-fit');
    expect(fit?.hidden).toBe(false);
    fit?.click();
    const change = query.mock.calls[0]?.[0] ?? ((current: string) => current);
    expect(change('t=2026-01-01T12:00Z&cal=gregorian&cam=1,2,3&layers=empires')).toBe(
      'cam=1,2,3&layers=empires&ma=0.315&scale=ice',
    );
  });
});
