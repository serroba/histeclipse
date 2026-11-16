/**
 * The bars that run the time in place of the years' own (#805): the launches', while the
 * spacecraft are on (#702), and ozone's, while its layer is on and they are off. The page
 * mounts them as one part: each shows only when its own rule says so, and they never both do.
 */

import { mountOzoneBar } from './ozone';
import { mountLaunches, type LaunchesContext, type LaunchesPart } from './spacecraft';
import { element } from '../ui/dom';

/** An element that holds others without being a box itself: its children lie where it does. */
function together(tag: 'div' | 'span', ...children: HTMLElement[]): HTMLElement {
  const holder = element(tag, { class: 'time-bars' }, ...children);
  // Through the style object: the CSP allows no style attribute.
  holder.style.display = 'contents';
  return holder;
}

export function mountTimeBars(context: LaunchesContext): LaunchesPart {
  const launches = mountLaunches(context);
  const ozone = mountOzoneBar(context);
  return {
    root: together('div', launches.root, ozone.root),
    extras: together('span', launches.extras, ozone.extras),
    show(state) {
      launches.show(state);
      ozone.show(state);
    },
    render(state) {
      launches.render(state);
      ozone.render(state);
    },
    earthFace: launches.earthFace,
  };
}
