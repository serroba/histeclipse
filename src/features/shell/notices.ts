/** What went wrong, told to the reader once each (#474), each closed by the reader (#944). */

import { element } from '../../ui/dom';
import './notices.css';

export interface Notices {
  readonly list: HTMLElement;
  /**
   * Tell the reader something went wrong; a failure asked again says so once. With `retry`, the
   * notice offers Try again, which closes it and asks again (#1130).
   */
  readonly notify: (message: string, retry?: () => void) => void;
}

export function createNotices(): Notices {
  const list = element('ul', { class: 'notices', role: 'status', 'aria-live': 'polite' });
  return {
    list,
    notify: (message, retry) => {
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
      if (retry !== undefined) {
        const again = element('button', { type: 'button', class: 'notice-retry' }, 'Try again');
        again.addEventListener('click', () => {
          notice.remove();
          retry();
        });
        close.before(again);
      }
      list.append(notice);
    },
  };
}
