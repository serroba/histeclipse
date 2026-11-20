/**
 * One line for a first visit: what the site is and where to start, Explore (#724). It goes, and is remembered
 * in this browser, once closed, followed, or once the visitor has found their own way in;
 * without storage (private windows) it simply shows on bare visits.
 */

import { element } from './dom';
import './welcome.css';

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

/** Where the welcome's two ways in lead: an eclipse to see at once (#954), or Explore. */
export interface WelcomeWays {
  readonly eclipse: () => void;
  readonly explore: () => void;
}

/**
 * The welcome line, hidden unless this is a bare visit (`firstVisit`) never welcomed before.
 * Each of its two buttons follows one way in.
 */
export function createWelcome(
  firstVisit: boolean,
  ways: WelcomeWays,
  storage: Storage | null = localStorageOrNull(),
): Welcome {
  const eclipse = element(
    'button',
    { type: 'button', class: 'welcome-start' },
    'See the eclipse of Thales',
  );
  const start = element('button', { type: 'button', class: 'welcome-start' }, 'Start exploring');
  const close = element(
    'button',
    { type: 'button', class: 'welcome-close', 'aria-label': 'Close the welcome' },
    '×',
  );
  const root = element(
    'p',
    { class: 'welcome', 'data-testid': 'welcome' },
    'Earth and sky through time: eclipses and missions, ice ages and moving continents, the first people and the states they built. ',
    eclipse,
    ' ',
    start,
    close,
  );
  root.hidden = !firstVisit || welcomedBefore(storage);
  const dismiss = (): void => {
    if (root.hidden === true) return;
    root.hidden = true;
    remember(storage);
  };
  eclipse.addEventListener('click', () => {
    dismiss();
    ways.eclipse();
  });
  start.addEventListener('click', () => {
    dismiss();
    ways.explore();
  });
  close.addEventListener('click', dismiss);
  return { root, dismiss };
}
