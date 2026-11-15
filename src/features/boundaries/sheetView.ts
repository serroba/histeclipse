/**
 * On a phone, a sheet over the globe hides it (seen on the planetary boundaries' story): this
 * switch lets the reader choose between the sheet's own view (its chart) and the globe. With the
 * globe chosen, the sheet folds to its header and the controls marked `.stage-keep`, at the top
 * of the screen; what it drives (the chart's year, the chapter) keeps driving the globe. On a
 * wide screen, where both fit, the switch is not shown.
 */

import { element } from '../../ui/dom';

type SheetView = 'sheet' | 'globe';

export interface SheetViewSwitch {
  readonly root: HTMLElement;
  /** The sheet it folds, once made (the switch goes inside it). */
  attach(sheet: HTMLElement): void;
  /** Show the sheet's view, as when it opens. */
  reset(): void;
}

export function createSheetViewSwitch(sheetLabel: string): SheetViewSwitch {
  let sheet: HTMLElement | null = null;
  let shown: SheetView = 'sheet';
  const choices: readonly (readonly [SheetView, string])[] = [
    ['sheet', sheetLabel],
    ['globe', 'Globe'],
  ];
  const buttons = choices.map(([view, label]) => {
    const button = element('button', { type: 'button', class: 'sheet-view-option' }, label);
    button.addEventListener('click', () => {
      show(view);
    });
    return [view, button] as const;
  });
  function show(view: SheetView): void {
    shown = view;
    if (sheet !== null) sheet.dataset['view'] = view;
    for (const [each, button] of buttons)
      button.setAttribute('aria-pressed', String(each === view));
  }
  show('sheet');
  return {
    root: element(
      'div',
      { class: 'sheet-view stage-keep', role: 'group', 'aria-label': 'Show' },
      ...buttons.map(([, button]) => button),
    ),
    attach: (target) => {
      sheet = target;
      show(shown);
    },
    reset: () => {
      show('sheet');
    },
  };
}
