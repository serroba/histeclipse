// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';

import { parseViewState } from '../../state/url';
import type { TimeEntry } from '../../time/timeEntry';
import { createTimeDialog } from './timeDialog';

const at = (query: string) => parseViewState(query, new Date('2026-11-15T00:00:00Z')).state;

function mount() {
  const entries: TimeEntry[] = [];
  const time = createTimeDialog((entry) => entries.push(entry), 2026);
  const date = document.createElement('time');
  date.textContent = '1 January 2026 CE';
  const trigger = time.trigger(date);
  document.body.append(trigger, time.dialog);
  const input = (): HTMLInputElement => {
    const found = time.dialog.querySelector<HTMLInputElement>('.time-entry-input');
    if (found === null) throw new Error('no input');
    return found;
  };
  const submit = (text: string): void => {
    input().value = text;
    time.dialog.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
  };
  return { time, trigger, entries, input, submit };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('Go to a time', () => {
  it('Given the date, When it is pressed, Then the dialog opens with the field focused, and again closes it', () => {
    const { time, trigger, input } = mount();
    expect(trigger.textContent).toBe('1 January 2026 CE');
    expect(trigger.getAttribute('aria-label')).toBe('Go to another date or age');
    expect(trigger.getAttribute('aria-describedby')).toBe('hud-date');
    trigger.click();
    expect(time.dialog.open).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(input());
    trigger.click();
    expect(time.dialog.open).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('Given something unreadable, Then it says why and stays; given an age, Then it goes there and closes', () => {
    const { time, trigger, entries, input, submit } = mount();
    trigger.click();
    submit('-44');
    const error = time.dialog.querySelector<HTMLElement>('[role="alert"]');
    expect(error?.hidden).toBe(false);
    expect(error?.textContent).toMatch(/44 BCE/);
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(entries).toEqual([]);
    submit('60 ka');
    expect(entries).toEqual([{ kind: 'ma', ma: 0.06 }]);
    expect(error?.hidden).toBe(true);
    expect(input().hasAttribute('aria-invalid')).toBe(false);
    expect(time.dialog.open).toBe(false);
  });

  it('Given a view, Then it says the moment and range shown, and the layers on with no data there', () => {
    const { time } = mount();
    time.render(at('t=1969-07-20T20:17Z&layers=humans,empires'));
    expect(time.dialog.textContent).toContain(
      'Showing 20 July 1969 CE, in the years, from 9700 BCE to today.',
    );
    const gaps = time.dialog.querySelector<HTMLElement>('.time-gaps');
    expect(gaps?.hidden).toBe(false);
    expect(gaps?.textContent).toMatch(/^Humans: nothing here\./);
    time.render(at('ma=100&scale=all'));
    expect(time.dialog.textContent).toContain('Showing 100 million years ago, in the last 540');
    expect(gaps?.hidden).toBe(true);
  });

  it('Given it is open, When Escape or Close are used, Then it closes, Escape returning to the date', () => {
    const { time, trigger } = mount();
    trigger.click();
    time.dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(time.dialog.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
    trigger.click();
    time.dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(time.dialog.open).toBe(true);
    time.dialog.querySelector<HTMLButtonElement>('.famous-close')?.click();
    expect(time.dialog.open).toBe(false);
    time.dialog.querySelector<HTMLButtonElement>('.famous-close')?.click();
    expect(time.dialog.open).toBe(false);
  });

  it('Given Explore is open, When the date is pressed, Then Explore closes: they share a side', () => {
    const { trigger } = mount();
    const explore = document.createElement('dialog');
    explore.className = 'explore-dialog';
    document.body.append(explore);
    explore.show();
    trigger.click();
    expect(explore.open).toBe(false);
  });
});
