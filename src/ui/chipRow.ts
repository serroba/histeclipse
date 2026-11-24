/**
 * A row of chips that scrolls sideways, its end faded while more of it is out of view (#1196).
 * Rendered with the page, often every frame while the years play, it is built again only when
 * what it shows changes, and whether its last chip is all in view is told by an observer, as
 * the browser lays the row out anyway: measuring it on each render would lay the whole page
 * out again there and then.
 */

export interface ChipRow {
  /**
   * Show what `build` makes, unless `inputs` are those it was last built from. `scrolls`: what
   * it makes is chips to scroll through, its last one to watch; not a message.
   */
  show(inputs: readonly unknown[], build: () => readonly HTMLElement[], scrolls?: boolean): void;
}

export function createChipRow(list: HTMLElement): ChipRow {
  const lastInView = new IntersectionObserver(
    (entries) => {
      const last = entries.at(-1);
      if (last !== undefined) list.dataset['more'] = String(last.intersectionRatio < 0.99);
    },
    { root: list, threshold: [0.99] },
  );
  let built: readonly unknown[] | null = null;
  return {
    show(inputs, build, scrolls = true) {
      const same =
        built !== null &&
        inputs.length === built.length &&
        inputs.every((input, index) => input === built?.[index]);
      if (same) return;
      built = inputs;
      const items = build();
      list.replaceChildren(...items);
      lastInView.disconnect();
      const last = scrolls ? items.at(-1) : undefined;
      if (last === undefined) delete list.dataset['more'];
      else lastInView.observe(last);
    },
  };
}
