/** `array[index]`, but a missing element is an error rather than `undefined`. */
export function elementAt<T>(array: readonly T[], index: number): T {
  if (!Number.isInteger(index) || index < 0 || index >= array.length) {
    throw new RangeError(`Index ${String(index)} is outside 0..${String(array.length - 1)}`);
  }
  return array[index] as T;
}

/** `array[index]` for typed arrays and other array-likes, with the same check. */
export function valueAt(array: ArrayLike<number>, index: number): number {
  const value = array[index];
  if (value === undefined) {
    throw new RangeError(`Index ${String(index)} is outside 0..${String(array.length - 1)}`);
  }
  return value;
}
