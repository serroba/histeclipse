/**
 * A data file loaded once, the first time it is asked for (#1047): its value once it has arrived,
 * null until then; asked again after a failure, it tries again.
 */

export interface Lazy<T> {
  /** The data, once it has arrived. */
  readonly value: T | null;
  /** Start loading it, unless it has arrived or is on its way. */
  ask(): void;
}

export function lazy<T>(
  load: () => Promise<T>,
  arrived: () => void,
  failed: (error: unknown) => void,
): Lazy<T> {
  let value: T | null = null;
  let loading = false;
  return {
    get value() {
      return value;
    },
    ask() {
      if (value !== null || loading) return;
      loading = true;
      load().then(
        (loaded) => {
          value = loaded;
          arrived();
        },
        (error: unknown) => {
          loading = false;
          failed(error);
        },
      );
    },
  };
}
