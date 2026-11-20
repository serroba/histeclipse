/**
 * Keep the globe centred in the space the panels leave free (#451). The date panel counts when
 * it spans most of the width (on phones, and on wide screens once it fills with controls); a
 * narrow one sits beside the globe.
 */

/** Pixels the zoom rail needs between the panels: its buttons, a short track and its reading. */
const ZOOM_RAIL_ROOM = 180;

export interface Layout {
  readonly root: HTMLElement;
  /** The date panel, and the panel at the bottom. */
  readonly top: Element;
  readonly bottom: HTMLElement;
  readonly zoomRail: HTMLElement;
  /** The space the panels leave free changed: top and bottom, px. */
  readonly onInsets: (top: number, bottom: number) => void;
}

export function keepCentred({ root, top, bottom, zoomRail, onInsets }: Layout): void {
  const update = (): void => {
    const spans = top.getBoundingClientRect().width > window.innerWidth * 0.55;
    const insets = {
      top: spans ? top.getBoundingClientRect().bottom : 0,
      bottom: bottom.getBoundingClientRect().height,
    };
    onInsets(insets.top, insets.bottom);
    // The zoom rail sits at the right, between the panels that reach it: the date panel only
    // when it spans the width (a narrow one, beside the globe, leaves the right edge free).
    root.style.setProperty('--free-top', `${String(insets.top)}px`);
    root.style.setProperty('--free-bottom', `${String(insets.bottom)}px`);
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
