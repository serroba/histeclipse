/**
 * Writes to the page that touch it only when something changes (#1187). What is redrawn every
 * frame (a clock's readout, the bodies' markers) would otherwise write the same again and
 * again, and each write that adds a node or flips an attribute makes the browser check the
 * page's `:has()` rules up to the root: the whole page restyled each frame.
 */

/** Set `node`'s text to `text`, in its text node where it has one, only if it changed. */
export function setText(node: HTMLElement, text: string): void {
  if (node.textContent === text) return;
  const only = node.firstChild;
  if (only instanceof Text && only.nextSibling === null) only.data = text;
  else node.textContent = text;
}

/** Show or hide `node`, only if that changes. */
export function setHidden(node: HTMLElement, hidden: boolean): void {
  if (node.hidden !== hidden) node.hidden = hidden;
}
