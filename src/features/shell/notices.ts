/** What went wrong, told to the reader once each (#474), each closed by the reader (#944). */

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
      const told = [...list.querySelectorAll('.notice-text')];
      if (told.some((text) => text.textContent === message)) return;
      const close = element(
        'button',
        { type: 'button', class: 'notice-close', 'aria-label': 'Dismiss' },
        '×',
      );
      const notice = element('li', {}, element('span', { class: 'notice-text' }, message), close);
      close.addEventListener('click', () => {
        notice.remove();
      });
      list.append(notice);
    },
  };
}
