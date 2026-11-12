/**
 * A slice of the view state (#381): some fields, their defaults, and how each is read from and
 * written into a link. Each slice lives in `state/slices/`; `ViewState` is made of them and
 * `url.ts` reads and writes each with `readSlice` and `writeSlice`, so a new field is one entry
 * in its slice's file rather than lines in the type, the defaults and the link format.
 */

/** How one field goes into a link and back. */
export interface Param<T> {
  /** Its name in the query string. */
  readonly key: string;
  /** The value a link gives; throws, with what was expected, when it cannot be read. */
  readonly parse: (raw: string) => T;
  /** What the link says; null leaves it out, so the default is read back. */
  readonly format: (value: T) => string | null;
}

/** A codec for every field of the slice, in the order they appear in a link. */
export type Params<S> = { readonly [K in keyof S]: Param<S[K]> };

/** One of `options`, or an error saying which were expected. */
export function oneOf<const T extends string>(raw: string, options: readonly T[], what: string): T {
  const match = options.find((option) => option === raw);
  if (match === undefined) {
    throw new Error(`unknown ${what}; expected one of ${options.join(', ')}`);
  }
  return match;
}

/** A field that is one of a fixed list, left out of links when it is `absent`. */
export function choice<const T extends string>(
  key: string,
  options: readonly T[],
  absent: T,
): Param<T> {
  return {
    key,
    parse: (raw) => oneOf(raw, options, key),
    format: (value) => (value === absent ? null : value),
  };
}

/** A field that is one of a fixed list, or null (closed, none) and left out of links. */
export function choiceOrNull<const T extends string>(
  key: string,
  options: readonly T[],
): Param<T | null> {
  return { key, parse: (raw) => oneOf(raw, options, key), format: (value) => value };
}

/** Reads a field's parameter, or keeps the fallback when the link lacks it or it cannot be read. */
export type Reader = <T>(key: string, parse: (raw: string) => T, fallback: T) => T;

/** Read a slice from a link, field by field, each falling back to its default. */
export function readSlice<S extends object>(params: Params<S>, defaults: S, read: Reader): S {
  const slice: Partial<S> = {};
  for (const field of Object.keys(params) as (keyof S)[]) {
    const param = params[field];
    slice[field] = read(param.key, param.parse, defaults[field]);
  }
  return slice as S;
}

/** Write a slice into a link, in its fields' order, leaving out what reads back as the default. */
export function writeSlice<S extends object>(
  params: Params<S>,
  state: S,
  set: (key: string, value: string) => void,
): void {
  for (const field of Object.keys(params) as (keyof S)[]) {
    const param = params[field];
    const value = param.format(state[field]);
    if (value !== null) set(param.key, value);
  }
}
