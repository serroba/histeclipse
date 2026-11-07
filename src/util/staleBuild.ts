/**
 * A page opened before a deploy still names the old build's files, which the deploy removed: the
 * first part it loads late (the sky, the planets' theory) then fails to fetch. Vite reports that
 * as `vite:preloadError`; the page reloads once to pick up the new build. Should the new build
 * fail too, within a minute, it does not reload again, and the error shows as any other.
 */

const RELOADED_AT = 'histeclipse:reloaded-for-new-build';
/** A second failure this soon after a reload is not a stale page: no loop. */
export const RELOAD_GUARD_MS = 60_000;

/** Whether to reload now, noting it in `storage` so a failing new build is not reloaded again. */
export function shouldReload(storage: Storage, now: number): boolean {
  const last = Number(storage.getItem(RELOADED_AT));
  if (Number.isFinite(last) && last > 0 && now - last < RELOAD_GUARD_MS) return false;
  storage.setItem(RELOADED_AT, String(now));
  return true;
}

/** Reload once when a late part of the app is gone after a deploy. */
export function reloadOnStaleBuild(target: Window): void {
  target.addEventListener('vite:preloadError', () => {
    try {
      if (shouldReload(target.sessionStorage, Date.now())) target.location.reload();
    } catch {
      // No session storage (blocked): no way to guard against a loop, so the error shows.
    }
  });
}
