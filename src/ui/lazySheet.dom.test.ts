// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { lazySheet, type Sheet } from './lazySheet';

function made(): Sheet<string> & { readonly shown: (string | null)[] } {
  const shown: (string | null)[] = [];
  return {
    dialog: document.createElement('dialog'),
    shown,
    show: (view) => {
      shown.push(view);
    },
  };
}

describe('a sheet loaded the first time it shows (#220)', () => {
  it('Given nothing asked of it, Then nothing loads, and a hidden stand-in holds its place', () => {
    const make = vi.fn(() => Promise.resolve(made()));
    const sheet = lazySheet(make, vi.fn());
    sheet.show(null);
    expect(make).not.toHaveBeenCalled();
    expect(sheet.element.hidden).toBe(true);
  });

  it('Given views asked while it loads, Then it loads once, takes the stand-in’s place and shows the last', async () => {
    const real = made();
    const make = vi.fn(() => Promise.resolve(real));
    const page = document.createElement('div');
    const sheet = lazySheet(make, vi.fn());
    page.append(sheet.element);
    sheet.show('a');
    sheet.show('b');
    await vi.waitFor(() => {
      expect(real.shown).toEqual(['b']);
    });
    expect(make).toHaveBeenCalledOnce();
    expect(page.firstElementChild).toBe(real.dialog);
    sheet.show(null);
    expect(real.shown).toEqual(['b', null]);
  });

  it('Given it closed before it loaded, Then it loads closed', async () => {
    const real = made();
    const sheet = lazySheet(() => Promise.resolve(real), vi.fn());
    sheet.show('a');
    sheet.show(null);
    await vi.waitFor(() => {
      expect(real.shown).toEqual([null]);
    });
  });

  it('Given the load fails, Then it says so, and tries again at the next view', async () => {
    const real = made();
    const make = vi
      .fn<() => Promise<Sheet<string>>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(real);
    const failed = vi.fn();
    const sheet = lazySheet(make, failed);
    sheet.show('a');
    await vi.waitFor(() => {
      expect(failed).toHaveBeenCalledWith(new Error('offline'));
    });
    sheet.show('b');
    await vi.waitFor(() => {
      expect(real.shown).toEqual(['b']);
    });
  });
});
