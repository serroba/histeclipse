import { describe, expect, it } from 'vitest';

import { playerFor, playKey, type KeyPlayer } from './playKeys';

const press = (key: string, more: Partial<Parameters<typeof playKey>[0]> = {}) =>
  playKey({
    key,
    modified: false,
    repeat: false,
    takesSpace: false,
    takesArrows: false,
    ...more,
  });

describe('what a key asks of what plays', () => {
  it('Space plays or pauses, and the arrows step back and on', () => {
    expect(press(' ')).toBe('toggle');
    expect(press('ArrowLeft')).toBe('back');
    expect(press('ArrowRight')).toBe('on');
  });

  it('any other key is left to the page', () => {
    expect(press('ArrowUp')).toBeNull();
    expect(press('Enter')).toBeNull();
    expect(press('k')).toBeNull();
  });

  it('a key with Ctrl, Meta or Alt is the browser’s, or another shortcut’s', () => {
    expect(press(' ', { modified: true })).toBeNull();
    expect(press('ArrowLeft', { modified: true })).toBeNull();
  });

  it('Space on a button presses the button, but the arrows there still step', () => {
    expect(press(' ', { takesSpace: true })).toBeNull();
    expect(press('ArrowRight', { takesSpace: true })).toBe('on');
  });

  it('the arrows in a field or on a slider move there, but Space on a slider still pauses', () => {
    expect(press('ArrowLeft', { takesArrows: true })).toBeNull();
    expect(press('ArrowRight', { takesArrows: true })).toBeNull();
    expect(press(' ', { takesArrows: true })).toBe('toggle');
  });

  it('Space held down does not play and pause over and over; an arrow held keeps stepping', () => {
    expect(press(' ', { repeat: true })).toBeNull();
    expect(press('ArrowRight', { repeat: true })).toBe('on');
  });
});

describe('which player the keys go to', () => {
  const focus = {} as Element;
  const player = (more: Partial<KeyPlayer> = {}): KeyPlayer => ({
    shown: () => true,
    toggle: () => undefined,
    step: () => undefined,
    ...more,
  });

  it('nothing shown, nothing to play', () => {
    expect(playerFor([], null)).toBeNull();
    expect(playerFor([player({ shown: () => false })], null)).toBeNull();
  });

  it('the only one shown, whatever else has joined', () => {
    const years = player();
    expect(playerFor([years, player({ shown: () => false })], null)).toBe(years);
  });

  it('one laid over the page comes before the page’s own, whichever joined first', () => {
    const sheet = player({ over: true });
    const years = player();
    expect(playerFor([sheet, years], null)).toBe(sheet);
    expect(playerFor([years, sheet], null)).toBe(sheet);
  });

  it('the one holding the focus comes before any other', () => {
    const sheet = player({ over: true });
    const years = player({ holds: (at) => at === focus });
    expect(playerFor([years, sheet], focus)).toBe(years);
  });

  it('a hidden one is passed over even if it holds the focus', () => {
    const years = player();
    const gone = player({ shown: () => false, holds: () => true, over: true });
    expect(playerFor([years, gone], focus)).toBe(years);
  });

  it('under a modal dialog, only one holding the focus within it', () => {
    const years = player();
    const within = player({ holds: (at) => at === focus });
    expect(playerFor([years], focus, true)).toBeNull();
    expect(playerFor([years, within], focus, true)).toBe(within);
  });
});
