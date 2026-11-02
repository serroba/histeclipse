/**
 * One line for a first visit: what the site is and where to start. It goes, and is remembered
 * in this browser, once closed, followed, or once the visitor has found their own way in;
 * without storage (private windows) it simply shows on bare visits.
 */

import { element } from './dom';

const KEY = 'histeclipse.welcomed';

function welcomedBefore(storage: Storage | null): boolean {
  try {
    return storage?.getItem(KEY) === 'yes';
  } catch {
    return false;
  }
}

function remember(storage: Storage | null): void {
  try {
    storage?.setItem(KEY, 'yes');
  } catch {
    // Storage blocked: the welcome shows again next time, which is harmless.
  }
}

function localStorageOrNull(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export interface Welcome {
  readonly root: HTMLElement;
  /** Retire it for good, as when the visitor picks something on their own. */
  dismiss(): void;
}

/**
 * The welcome line, hidden unless this is a bare visit (`firstVisit`) never welcomed before.
 * `onStart` follows its suggestion.
 */
export function createWelcome(
  firstVisit: boolean,
  onStart: () => void,
  storage: Storage | null = localStorageOrNull(),
): Welcome {
  const start = element(
    'button',
    { type: 'button', class: 'welcome-start' },
    'Start with a famous eclipse',
  );
  const close = element(
    'button',
    { type: 'button', class: 'welcome-close', 'aria-label': 'Close the welcome' },
    '×',
  );
  const root = element(
    'p',
    { class: 'welcome', 'data-testid': 'welcome' },
    'Where eclipses fell across thousands of years of history, and how the sky looked to the people who saw them. ',
    start,
    close,
  );
  root.hidden = !firstVisit || welcomedBefore(storage);
  const dismiss = (): void => {
    if (root.hidden === true) return;
    root.hidden = true;
    remember(storage);
  };
  start.addEventListener('click', () => {
    dismiss();
    onStart();
  });
  close.addEventListener('click', dismiss);
  return { root, dismiss };
}
