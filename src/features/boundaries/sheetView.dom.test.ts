// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { createSheetViewSwitch } from './sheetView';

describe('choosing the chart or the globe on a phone', () => {
  it('Given a sheet, Then it starts on its own view, switches to the globe and back, and resets', () => {
    const sheet = document.createElement('dialog');
    const view = createSheetViewSwitch('Chart');
    view.attach(sheet);
    const [chart, globe] = [...view.root.querySelectorAll('button')];
    expect(sheet.dataset['view']).toBe('sheet');
    expect(chart?.getAttribute('aria-pressed')).toBe('true');
    globe?.click();
    expect(sheet.dataset['view']).toBe('globe');
    expect(globe?.getAttribute('aria-pressed')).toBe('true');
    expect(chart?.getAttribute('aria-pressed')).toBe('false');
    view.reset();
    expect(sheet.dataset['view']).toBe('sheet');
    globe?.click();
    chart?.click();
    expect(sheet.dataset['view']).toBe('sheet');
  });

  it('Given a choice made before the sheet is attached, Then the sheet takes it', () => {
    const view = createSheetViewSwitch('Chart');
    view.root.querySelectorAll('button')[1]?.click();
    const sheet = document.createElement('dialog');
    view.attach(sheet);
    expect(sheet.dataset['view']).toBe('globe');
  });
});
