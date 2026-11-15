// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { failedNotice } from '.';

describe('About here, when the texts did not load', () => {
  it('Given a failed load, Then it says so and Try again asks once more', () => {
    const retry = vi.fn();
    const notice = failedNotice(retry);
    expect(notice.textContent).toBe('Could not load the texts. Try again');
    notice.querySelector('button')?.click();
    expect(retry).toHaveBeenCalledOnce();
  });
});
