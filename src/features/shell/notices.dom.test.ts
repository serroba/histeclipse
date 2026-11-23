// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { createNotices } from './notices';

describe('the notices (#474, #944)', () => {
  it('Given a failure told twice, Then it is listed once', () => {
    const { list, notify } = createNotices();
    notify('The map could not load.');
    notify('The map could not load.');
    expect([...list.querySelectorAll('.notice-text')].map((text) => text.textContent)).toEqual([
      'The map could not load.',
    ]);
  });

  it('Given a notice, When the reader dismisses it, Then it goes, and the same failure can be told again', () => {
    const { list, notify } = createNotices();
    notify('Ignored view="sky": unknown view');
    list.querySelector<HTMLButtonElement>('button[aria-label="Dismiss"]')?.click();
    expect(list.children).toHaveLength(0);
    notify('Ignored view="sky": unknown view');
    expect(list.children).toHaveLength(1);
  });

  it('Given a failure with a way to ask again, When the reader picks Try again, Then the notice goes and it is asked again (#1130)', () => {
    const { list, notify } = createNotices();
    let asked = 0;
    notify('Could not load the eruptions: 503', () => {
      asked += 1;
    });
    expect(list.querySelector('.notice-text')?.textContent).toBe(
      'Could not load the eruptions: 503',
    );
    list.querySelector<HTMLButtonElement>('.notice-retry')?.click();
    expect(asked).toBe(1);
    expect(list.children).toHaveLength(0);
  });

  it('Given a failure without one, Then it offers no Try again', () => {
    const { list, notify } = createNotices();
    notify('The map could not load.');
    expect(list.querySelector('.notice-retry')).toBeNull();
  });
});
