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
  };
  const observer = new ResizeObserver(update);
  observer.observe(top);
  observer.observe(bottom);
  window.addEventListener('resize', update);
}
