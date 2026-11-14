/**
 * Under the date, the destination arrived at (#729): its name, and once the reader has moved
 * away from its time, Fit this topic to bring that time back, saying which.
 */

import { destinationById, type Destination } from '../../explore/destinations';
import { frameWords, showsFrame } from '../../explore/frame';
import type { ViewState } from '../../state/viewState';
import { element } from '../../ui/dom';

export interface FitLine {
  readonly root: HTMLElement;
  render(state: ViewState): void;
}

export function createFitLine(onFit: (destination: Destination) => void): FitLine {
  const name = element('span', { class: 'explore-context-name' });
  const fit = element('button', { type: 'button', class: 'explore-fit' }, 'Fit this topic');
  const root = element(
    'p',
    { class: 'explore-context', 'aria-live': 'polite', hidden: '' },
    name,
    fit,
  );
  let shown: Destination | undefined;
  fit.addEventListener('click', () => {
    if (shown !== undefined) onFit(shown);
  });
  return {
    root,
    render(state) {
      shown = state.explore === null ? undefined : destinationById(state.explore);
      root.hidden = shown === undefined;
      if (shown === undefined) return;
      name.textContent = shown.label;
      const words = frameWords(shown.frame);
      fit.hidden = showsFrame(state, shown.frame);
      fit.title = `Back to ${words}`;
      fit.setAttribute('aria-label', `Fit this topic: ${words}`);
    },
  };
}
