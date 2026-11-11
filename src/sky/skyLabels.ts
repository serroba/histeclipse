/**
 * The names over the sky view: planets, compass points, constellations and marks, each a span
 * the sky scene places after every frame, hidden until it is.
 */

import './skyLabels.css';

/** The layer the sky's names go in, over the sky drawn in `container`. */
export function createSkyLabelLayer(container: HTMLElement): HTMLElement {
  const layer = document.createElement('div');
  layer.className = 'sky-labels';
  container.append(layer);
  return layer;
}

/** A name of this kind (`is-planet`, `is-compass`, `is-constellation`, `is-mark`) in `layer`. */
export function skyLabel(layer: HTMLElement, text: string, kind: string): HTMLElement {
  const label = document.createElement('span');
  label.className = `sky-label ${kind}`;
  label.textContent = text;
  label.hidden = true;
  layer.append(label);
  return label;
}

/** Whether two names' boxes on screen overlap. */
export function overlaps(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}
