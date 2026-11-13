import { describe, expect, it } from 'vitest';
import { delegate } from './delegate';

class Counter {
  #count = 0;
  readonly label = 'counter';

  add(by: number): number {
    this.#count += by;
    return this.#count;
  }

  get count(): number {
    return this.#count;
  }
}

describe('delegate', () => {
  it('binds the named methods to the target, private state and all', () => {
    const counter = new Counter();
    const { add } = delegate(counter, ['add']);
    expect(add(2)).toBe(2);
    expect(add(3)).toBe(5);
    expect(counter.count).toBe(5);
  });

  it('gives only the methods named', () => {
    const share = delegate(new Counter(), ['add']);
    expect(Object.keys(share)).toEqual(['add']);
  });

  it('refuses a name that is not a method', () => {
    expect(() => delegate(new Counter(), ['label'])).toThrow('label is not a method');
  });
});
