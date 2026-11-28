// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

const made = vi.hoisted(() => ({
  dialog: null as HTMLElement | null,
  shown: [] as unknown[][],
  args: [] as unknown[],
}));
vi.mock('./impactPathsSheet', () => {
  return {
    createImpactPathsSheet: (...args: unknown[]) => {
      made.args = args;
      made.dialog = document.createElement('dialog');
      return {
        dialog: made.dialog,
        show: (...shown: unknown[]) => made.shown.push(shown),
      };
    },
  };
});

const { lazyImpactPaths } = await import('./impactPathsLazy');

describe('the impacts’ paths, their code loaded when first opened (#220)', () => {
  it('Given the view opens them, Then the sheet is made with the app’s callbacks and shows that view', async () => {
    const onRequest = vi.fn();
    const why = document.createElement('button');
    const paths = lazyImpactPaths(onRequest, vi.fn(), vi.fn(), vi.fn(), why, vi.fn());
    const page = document.createElement('div');
    page.append(paths.element);
    paths.show(null, 0, 'map');
    expect(made.dialog).toBeNull();
    paths.show({ id: 7 }, 66, 'box');
    await vi.waitFor(() => {
      expect(made.shown).toEqual([[{ id: 7 }, 66, 'box']]);
    });
    expect(made.args[0]).toBe(onRequest);
    expect(made.args[4]).toBe(why);
    expect(page.firstElementChild).toBe(made.dialog);
    paths.show(null, 0, 'box');
    expect(made.shown.at(-1)).toEqual([null, 0, 'map']);
  });
});
