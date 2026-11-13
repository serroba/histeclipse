/**
 * A part's share of a contract (#603): the methods named, bound to the part, so the globe can
 * answer `Globe` with what each part already does instead of a one-line wrapper per method. The
 * compiler still checks each one against the contract where the shares are put together.
 */

/** The methods `names` of `target`, each bound to it. */
export function delegate<T extends object, K extends keyof T>(
  target: T,
  names: readonly K[],
): Pick<T, K> {
  const share: Partial<Pick<T, K>> = {};
  for (const name of names) {
    const member: unknown = target[name];
    if (typeof member !== 'function') {
      throw new TypeError(`${String(name)} is not a method to delegate to`);
    }
    share[name] = (member as (...args: unknown[]) => unknown).bind(target) as T[K];
  }
  return share as Pick<T, K>;
}
