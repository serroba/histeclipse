/**
 * A moment as a reader types it (#730): a year ("1969", "44 BCE", "AD 33", "1200 CE"), or an age
 * ("60 ka", "60,000 years ago", "100 Ma", "66 million years ago", "3.5 Ga", "today"). Years are
 * read as astronomical years (1 BCE is 0); ages as millions of years before present. A bare
 * negative number is ambiguous between conventions, so it is refused with what to write.
 */

/** Earth's age, million years: nothing older is shown. */
const EARTH_AGE_MA = 4568;

export type TimeEntry =
  { readonly kind: 'year'; readonly year: number } | { readonly kind: 'ma'; readonly ma: number };

export type TimeEntryResult =
  | { readonly ok: true; readonly entry: TimeEntry }
  | { readonly ok: false; readonly message: string };

const AGE_UNITS: readonly (readonly [RegExp, number])[] = [
  [/^(?:ga|gya|byr|billion years?(?: ago)?)$/, 1000],
  [/^(?:ma|mya|myr|million years?(?: ago)?)$/, 1],
  [/^(?:ka|kya|kyr|thousand years?(?: ago)?)$/, 0.001],
  [/^(?:years? ago|ya)$/, 0.000001],
];

const ERAS: readonly (readonly [RegExp, 'bce' | 'ce'])[] = [
  [/^(?:bce|bc|b\.c\.e?\.?)$/, 'bce'],
  [/^(?:ce|ad|a\.d\.)$/, 'ce'],
];

const HELP = 'That is not a year or an age that can be read.';

function fail(message: string): TimeEntryResult {
  return { ok: false, message };
}

function age(amount: number, unit: number): TimeEntryResult {
  const ma = amount * unit;
  if (ma > EARTH_AGE_MA) return fail('Earth is about 4.57 billion years old: nothing is older.');
  return { ok: true, entry: { kind: 'ma', ma } };
}

function year(amount: number, era: 'bce' | 'ce', present: number): TimeEntryResult {
  if (!Number.isInteger(amount) || amount < 1)
    return fail('A year is a whole number, from 1 on: 1 BCE, 1 CE.');
  const astronomical = era === 'bce' ? 1 - amount : amount;
  if (astronomical > present) return fail(`That is in the future: today is ${String(present)}.`);
  return { ok: true, entry: { kind: 'year', year: astronomical } };
}

/** A number and what follows it: a year with its era, or an age with its unit. */
function numbered(typed: string, present: number): TimeEntryResult {
  const match = /^(\d[\d,]*(?:\.\d+)?)\s*(.*)$/.exec(typed);
  if (match === null) return fail(HELP);
  const amount = Number((match[1] ?? '').replaceAll(',', ''));
  const unit = match[2] ?? '';
  if (unit === '') return year(amount, 'ce', present);
  for (const [pattern, scale] of AGE_UNITS) if (pattern.test(unit)) return age(amount, scale);
  for (const [pattern, era] of ERAS) if (pattern.test(unit)) return year(amount, era, present);
  return fail(HELP);
}

/** Read what the reader typed; `present` is this year. */
export function parseTimeEntry(text: string, present: number): TimeEntryResult {
  const typed = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (typed === '') return fail('Type a year or an age.');
  if (typed === 'today' || typed === 'now')
    return { ok: true, entry: { kind: 'year', year: present } };
  if (/^-\d/.test(typed)) return fail('Say which era: write 44 BCE rather than −44.');
  // "AD 33": the era before the number.
  const before = /^(ad|a\.d\.|ce)\s*(\d[\d,]*)$/.exec(typed);
  if (before !== null) return year(Number((before[2] ?? '').replaceAll(',', '')), 'ce', present);
  return numbered(typed, present);
}
