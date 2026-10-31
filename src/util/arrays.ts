/** `array[index]`, but a missing element is an error rather than `undefined`. */
export function elementAt<T>(array: readonly T[], index: number): T {
  if (!Number.isInteger(index) || index < 0 || index >= array.length) {
    throw new RangeError(`Index ${String(index)} is outside 0..${String(array.length - 1)}`);
  }
  return array[index] as T;
}
