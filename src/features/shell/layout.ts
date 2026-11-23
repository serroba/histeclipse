/**
 * Keep the globe centred in the space the panels leave free (#451). The date panel counts when
 * it spans most of the width (on phones, and on wide screens once it fills with controls); a
 * narrow one sits beside the globe. On a short phone the date panel folds, so there is space to
 * keep (#975), and so does the year's bar (#1049).
 */

import { foldBar, foldHud } from './hudFold';
import './sheetStrip.css';
import './touch.css';

/** Pixels the zoom rail needs between the panels: its buttons, a short track and its reading. */
const ZOOM_RAIL_ROOM = 180;

export interface Layout {
  readonly root: HTMLElement;
  /** The date panel, and the panel at the bottom. */
  readonly top: HTMLElement;
  readonly bottom: HTMLElement;
  readonly zoomRail: HTMLElement;
  /** The space the panels leave free changed: top, bottom and left, px. */
  readonly onInsets: (top: number, bottom: number, left: number) => void;
}

export function keepCentred({ root, top, bottom, zoomRail, onInsets }: Layout): void {
  foldHud(top);
  foldBar(bottom);
  const update = (): void => {
    keepNameClear(top);
    const box = top.getBoundingClientRect();
    const spans = box.width > window.innerWidth * 0.55;
    const insets = {
      top: spans ? box.bottom : 0,
      bottom: bottom.getBoundingClientRect().height,
    };
    // A narrow date panel that reaches down past the middle of the free height would cover the
    // globe's left side: the globe moves over into the space to its right (#946).
    const middle = (window.innerHeight - insets.bottom) / 2;
    const left = !spans && box.bottom > middle ? box.right : 0;
    onInsets(insets.top, insets.bottom, left);
    // The zoom rail sits at the right, between the panels that reach it: the date panel only
    // when it spans the width (a narrow one, beside the globe, leaves the right edge free).
    root.style.setProperty('--free-top', `${String(insets.top)}px`);
    root.style.setProperty('--free-bottom', `${String(insets.bottom)}px`);
    root.style.setProperty('--free-left', `${String(left)}px`);
    const free = window.innerHeight - insets.top - insets.bottom;
    zoomRail.classList.toggle('is-cramped', free < ZOOM_RAIL_ROOM);
    // Deep time's sheet stops short of the date panel where the two share columns (#237).
    const panel = top.getBoundingClientRect();
    const sheet = bottom.querySelector('.deep-time')?.getBoundingClientRect();
    const shared =
      sheet !== undefined &&
      sheet.width > 0 &&
      panel.right > sheet.left &&
      panel.left < sheet.right;
    root.style.setProperty('--hud-clear', `${String(shared ? panel.bottom + 8 : 0)}px`);
    // The panels beside the globe stop short of the date panel, at the left (#526).
    root.style.setProperty('--hud-bottom', `${String(panel.bottom)}px`);
    // And the date panel stops short of the bottom's cards it shares columns with (#943): its
    // own controls scroll rather than run under an eclipse card. Deep time's sheet gives way
    // to it instead (above), so it does not count here.
    const room = hudRoom(panel, bottom);
    const capped = top.scrollHeight > room;
    root.style.setProperty('--hud-max', capped ? `${String(room)}px` : 'none');
    root.toggleAttribute('data-hud-capped', capped);
  };
  const observer = new ResizeObserver(update);
  observer.observe(top);
  observer.observe(bottom);
  window.addEventListener('resize', update);
}

/**
 * Where the tools sit over the date panel's top right, the panel is never narrower than the name
 * and them (#1154): with less in it (deep time has no viewpoints) it would shrink under them.
 * Never wider than the screen leaves it.
 */
function keepNameClear(top: HTMLElement): void {
  const tools = top.querySelector<HTMLElement>('.hud-tools');
  const name = top.querySelector<HTMLElement>('h1 > a');
  if (tools === null || name === null || getComputedStyle(tools).position !== 'absolute') {
    top.style.minWidth = '';
    return;
  }
  // The panel's padding at the left (18) and the tools' inset at the right (10), and a gap.
  const wanted = name.getBoundingClientRect().width + tools.getBoundingClientRect().width + 44;
  top.style.minWidth = `${String(Math.ceil(Math.min(wanted, window.innerWidth - 32)))}px`;
}

/** The date panel's room: down to the highest card below it in its columns, if any. */
function hudRoom(panel: DOMRect, bottom: HTMLElement): number {
  let highest = Infinity;
  for (const child of bottom.children) {
    if (child.classList.contains('deep-time')) continue;
    const box = child.getBoundingClientRect();
    if (box.height > 0 && box.width > 0 && panel.right > box.left && panel.left < box.right) {
      highest = Math.min(highest, box.top);
    }
  }
  return Math.max(highest - panel.top - 8, 120);
}
