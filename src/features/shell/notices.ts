/** What went wrong, told to the reader once each (#474). */

import { element } from '../../ui/dom';
import './notices.css';

export interface Notices {
  readonly list: HTMLElement;
  /** Tell the reader something went wrong; a failure asked again says so once. */
  readonly notify: (message: string) => void;
}

export function createNotices(): Notices {
  const list = element('ul', { class: 'notices', role: 'status', 'aria-live': 'polite' });
  return {
    list,
    notify: (message) => {
      if ([...list.children].some((notice) => notice.textContent === message)) return;
      list.append(element('li', {}, message));
    },
  };
}
