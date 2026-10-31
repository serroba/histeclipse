/** A minimal observable value: the single source of truth for the current view. */

export interface Store<T> {
  get(): T;
  /** Replace the value, or derive it from the current one. Listeners run only on change. */
  set(next: T | ((current: T) => T)): void;
  /** Listen for changes; returns a function that stops listening. */
  subscribe(listener: (value: T, previous: T) => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<(value: T, previous: T) => void>();
  return {
    get: () => value,
    set(next) {
      const previous = value;
      value = typeof next === 'function' ? (next as (current: T) => T)(value) : next;
      if (Object.is(value, previous)) return;
      for (const listener of [...listeners]) listener(value, previous);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
