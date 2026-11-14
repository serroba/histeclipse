// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { parseViewState } from '../../state/url';
import { createFitLine } from './fitLine';

const at = (query: string) => parseViewState(query, new Date('2026-11-15T00:00:00Z')).state;

describe('the line under the date', () => {
  it('Given no destination, or an unknown one, Then it is hidden', () => {
    const line = createFitLine(vi.fn());
    line.render(at(''));
    expect(line.root.hidden).toBe(true);
    line.render(at('explore=atlantis'));
    expect(line.root.hidden).toBe(true);
  });

  it('Given a destination, Then it is named; Fit shows only once its time is left, saying which', () => {
    const onFit = vi.fn();
    const line = createFitLine(onFit);
    const fit = line.root.querySelector<HTMLButtonElement>('.explore-fit');
    line.render(at('explore=ancient-australia&ma=100'));
    expect(line.root.hidden).toBe(false);
    expect(line.root.textContent).toContain('Ancient Australia');
    expect(fit?.hidden).toBe(true);
    line.render(at('explore=ancient-australia&ma=250'));
    expect(fit?.hidden).toBe(false);
    expect(fit?.getAttribute('aria-label')).toBe(
      'Fit this topic: 120 million years ago – 80 million years ago',
    );
    fit?.click();
    expect(onFit).toHaveBeenCalledWith(expect.objectContaining({ id: 'ancient-australia' }));
  });

  it('Given no destination, When its hidden Fit is pressed, Then nothing happens', () => {
    const onFit = vi.fn();
    const line = createFitLine(onFit);
    line.render(at(''));
    line.root.querySelector<HTMLButtonElement>('.explore-fit')?.click();
    expect(onFit).not.toHaveBeenCalled();
  });
});
