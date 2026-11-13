/**
 * The page's frame (#442): the header, the bar along the bottom, and everything else in the
 * order it stacks. The parts make their own elements; this only says where each one goes.
 */

import { element } from './dom';

/** The header: the name, the tools, the moment, and the switches between views. */
interface HeaderParts {
  /** Where the name leads: today on the globe, as a first visit opens. */
  readonly home: string;
  readonly tools: readonly Node[];
  readonly date: Node;
  readonly time: Node;
  readonly detail: Node;
  readonly termNote: Node;
  readonly welcome: Node;
  /** Earth's spans and its map's layers; away from Earth they rest (#329). */
  readonly actions: readonly Node[];
  readonly viewSwitch: Node;
  readonly skyControls: readonly Node[];
  readonly bodySwitches: readonly Node[];
  readonly skyCaptions: readonly Node[];
  readonly recordsBanner: Node;
  /** What is on screen now, each with the book that says why, and its sources' links. */
  readonly sources: Node;
  readonly textsHere: Node;
}

/** The bar along the bottom: the eclipse's card, the Holocene's bar, and deep time's. */
interface BottomParts {
  readonly eclipseCard: Node;
  readonly eclipseScrubber: Node;
  /** The bars of the Holocene, one showing at a time. */
  readonly holocene: readonly Node[];
  readonly deepBar: Node;
}

export interface PageParts {
  /** What lies under the header and the bottom bar: the globe, the sky, the rail, the sheets. */
  readonly under: readonly Node[];
  readonly header: HeaderParts;
  /** What lies between the header and the bottom bar: the notices, the glance, the way back. */
  readonly between: readonly Node[];
  readonly bottom: BottomParts;
  /** What lies over everything: the dialogs, and the shower's stage. */
  readonly over: readonly Node[];
}

export interface PageLayout {
  readonly hud: HTMLElement;
  readonly hudActions: HTMLElement;
  readonly bottom: HTMLElement;
}

function header(parts: HeaderParts, hudActions: HTMLElement): HTMLElement {
  return element(
    'header',
    { class: 'hud' },
    // The name leads home: today on the globe, as a first visit opens (welcome too, until the
    // visitor has dismissed it).
    element(
      'h1',
      {},
      element('a', { class: 'home', href: parts.home, title: 'Back to the start' }, 'histeclipse'),
    ),
    element('div', { class: 'hud-tools' }, ...parts.tools),
    element('p', { class: 'hud-when' }, parts.date, ' ', parts.time),
    parts.detail,
    parts.termNote,
    parts.welcome,
    hudActions,
    parts.viewSwitch,
    ...parts.skyControls,
    ...parts.bodySwitches,
    ...parts.skyCaptions,
    parts.recordsBanner,
    // Sources and what is written about here share a line, each a full row once open.
    element(
      'div',
      { class: 'hud-more' },
      element('details', { class: 'credits' }, element('summary', {}, 'Sources'), parts.sources),
      parts.textsHere,
    ),
  );
}

function bottomBar(parts: BottomParts): HTMLElement {
  return element(
    'div',
    { class: 'bottom', 'data-deep': 'off' },
    parts.eclipseCard,
    parts.eclipseScrubber,
    element('div', { class: 'holocene-bar' }, ...parts.holocene),
    parts.deepBar,
  );
}

/** Put the parts on the page, in `root`, replacing what was there. */
export function layOutPage(root: HTMLElement, parts: PageParts): PageLayout {
  const hudActions = element('div', { class: 'hud-actions' }, ...parts.header.actions);
  const hud = header(parts.header, hudActions);
  const bottom = bottomBar(parts.bottom);
  root.replaceChildren(...parts.under, hud, ...parts.between, bottom, ...parts.over);
  return { hud, hudActions, bottom };
}
