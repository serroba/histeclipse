import { describe, expect, it } from 'vitest';

import { parseTimeEntry } from './timeEntry';

const read = (text: string) => parseTimeEntry(text, 2026);

describe('a moment as typed', () => {
  it.each([
    ['1969', 1969],
    ['1969 CE', 1969],
    ['1200 ad', 1200],
    ['AD 33', 33],
    ['44 BCE', -43],
    ['44 bc', -43],
    ['1 BCE', 0],
    ['9,700 BCE', -9699],
    ['today', 2026],
    [' Now ', 2026],
  ])('Given %s, Then it is the astronomical year %d', (text, expected) => {
    expect(read(text)).toEqual({ ok: true, entry: { kind: 'year', year: expected } });
  });

  it.each([
    ['60 ka', 0.06],
    ['60 kya', 0.06],
    ['60,000 years ago', 0.06],
    ['21 thousand years ago', 0.021],
    ['100 Ma', 100],
    ['66 million years ago', 66],
    ['250 mya', 250],
    ['3.5 Ga', 3500],
    ['4.5 billion years ago', 4500],
  ])('Given %s, Then it is %d million years ago', (text, ma) => {
    const result = read(text);
    expect(result.ok && result.entry.kind === 'ma' ? result.entry.ma : null).toBeCloseTo(ma, 9);
  });

  it.each([
    ['', /Type a year or an age/],
    ['-44', /write 44 BCE rather than −44/],
    ['yesterday', /not a year or an age/],
    ['5 Ga', /4\.57 billion years old/],
    ['3000', /in the future/],
    ['44.5 BCE', /whole number/],
    ['0 BCE', /whole number/],
    ['12 parsecs', /not a year or an age/],
  ])('Given %s, Then it is refused, saying what to write', (text, message) => {
    const result = read(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(message);
  });
});
