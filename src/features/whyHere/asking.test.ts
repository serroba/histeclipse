import { describe, expect, it, vi } from 'vitest';
import { parseViewState } from '../../state/url';
import type { ViewState } from '../../state/viewState';
import { createAsking, hereOffered, whyAsked } from './asking';

const state = (): ViewState => parseViewState('', new Date(2024, 0, 1)).state;

describe('asking "Why here?"', () => {
  it("is offered on Earth's globe in the years only", () => {
    const years = state();
    expect(hereOffered(years)).toBe(true);
    expect(hereOffered({ ...years, mode: 'sky' })).toBe(false);
    expect(hereOffered({ ...years, focus: 'moon' })).toBe(false);
    expect(hereOffered({ ...years, ma: 66 })).toBe(false);
  });

  it('opens "Here" when asked, and shuts only "Here" when not', () => {
    expect(whyAsked(true, null)).toBe('here');
    expect(whyAsked(true, 'ways')).toBe('here');
    expect(whyAsked(false, 'here')).toBe(null);
    expect(whyAsked(false, 'ways')).toBe('ways');
  });

  it('toggles, stops when the sheet is closed, and marks the rail and the page', () => {
    let view = state();
    const store = {
      get: () => view,
      set: (update: (s: ViewState) => ViewState) => {
        view = update(view);
      },
    };
    const zoomRail = { setWhyHere: vi.fn() };
    const toggle = vi.fn<(token: string, force?: boolean) => boolean>(() => true);
    const asking = createAsking({ store, zoomRail, root: { classList: { toggle } } });
    expect(asking.on()).toBe(false);
    asking.toggle();
    expect(asking.on()).toBe(true);
    expect(view.why).toBe('here');
    asking.render(view);
    expect(zoomRail.setWhyHere).toHaveBeenLastCalledWith(true, true);
    expect(toggle).toHaveBeenLastCalledWith('is-asking-here', true);
    asking.sheetChanged('ways');
    expect(asking.on()).toBe(true);
    asking.sheetChanged(null);
    expect(asking.on()).toBe(false);
    asking.render({ ...view, ma: 66 });
    expect(zoomRail.setWhyHere).toHaveBeenLastCalledWith(false, false);
    expect(toggle).toHaveBeenLastCalledWith('is-asking-here', false);
    asking.toggle();
    asking.toggle();
    expect(view.why).toBe(null);
  });
});
