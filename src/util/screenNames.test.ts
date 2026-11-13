import { describe, expect, it } from 'vitest';

import { noteScreenNames, screenNames } from './screenNames';

describe('screenNames', () => {
  it('reads back what was noted last', () => {
    noteScreenNames({ shown: 12, total: 340 }, true);
    expect(screenNames()).toEqual({ shown: 12, total: 340, turning: true });
    noteScreenNames({ shown: 80, total: 340 }, false);
    expect(screenNames()).toEqual({ shown: 80, total: 340, turning: false });
  });

  it('leaves what it handed out as it was when noted again', () => {
    noteScreenNames({ shown: 1, total: 2 }, false);
    const before = screenNames();
    noteScreenNames({ shown: 3, total: 4 }, true);
    expect(before).toEqual({ shown: 1, total: 2, turning: false });
  });
});
