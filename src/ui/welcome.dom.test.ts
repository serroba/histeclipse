// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { createWelcome } from './welcome';

function storage(welcomed = false): Storage {
  const items = new Map<string, string>(welcomed ? [['histeclipse.welcomed', 'yes']] : []);
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
  } as unknown as Storage;
}

const ways = () => ({ eclipse: vi.fn(), explore: vi.fn() });

describe('the welcome (#724, #954)', () => {
  it('Given a first, bare visit, Then it shows, with an eclipse to see and Explore', () => {
    const welcome = createWelcome(true, ways(), storage());
    expect(welcome.root.hidden).toBe(false);
    expect([...welcome.root.querySelectorAll('.welcome-start')].map((b) => b.textContent)).toEqual([
      'See the eclipse of Thales',
      'Start exploring',
    ]);
  });

  it('Given a link to follow, or a visitor welcomed before, Then it stays hidden', () => {
    expect(createWelcome(false, ways(), storage()).root.hidden).toBe(true);
    expect(createWelcome(true, ways(), storage(true)).root.hidden).toBe(true);
  });

  it('When the eclipse is picked, Then it goes there, and the welcome goes for good', () => {
    const kept = storage();
    const go = ways();
    const welcome = createWelcome(true, go, kept);
    welcome.root.querySelector<HTMLButtonElement>('.welcome-start')?.click();
    expect(go.eclipse).toHaveBeenCalledOnce();
    expect(welcome.root.hidden).toBe(true);
    expect(createWelcome(true, ways(), kept).root.hidden).toBe(true);
  });

  it('When Start exploring is picked, Then Explore opens', () => {
    const go = ways();
    const welcome = createWelcome(true, go, storage());
    welcome.root.querySelectorAll<HTMLButtonElement>('.welcome-start')[1]?.click();
    expect(go.explore).toHaveBeenCalledOnce();
  });

  it('When closed, or dismissed by the page, Then it hides once and is remembered', () => {
    const kept = storage();
    const welcome = createWelcome(true, ways(), kept);
    welcome.root.querySelector<HTMLButtonElement>('.welcome-close')?.click();
    expect(welcome.root.hidden).toBe(true);
    welcome.dismiss();
    const again = createWelcome(true, ways(), storage());
    again.dismiss();
    expect(again.root.hidden).toBe(true);
  });

  it('Given storage that throws, Then it still shows and can be closed', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    const welcome = createWelcome(true, ways(), broken);
    expect(welcome.root.hidden).toBe(false);
    welcome.dismiss();
    expect(welcome.root.hidden).toBe(true);
  });

  it('Given no storage passed, Then it uses the browser’s', () => {
    window.localStorage.removeItem('histeclipse.welcomed');
    const welcome = createWelcome(true, ways());
    welcome.dismiss();
    expect(window.localStorage.getItem('histeclipse.welcomed')).toBe('yes');
  });
});
