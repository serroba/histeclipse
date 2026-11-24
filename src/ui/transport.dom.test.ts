// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { element } from './dom';
import { createStoryPlay, createTransport } from './transport';

function transport(slider: Readonly<Record<string, string>> = { min: '0', max: '100', step: '1' }) {
  const handlers = { onPlay: vi.fn(), onSlide: vi.fn() };
  const made = createTransport({ play: { className: 'play' }, slider }, handlers);
  const other = element('button', { type: 'button' }, 'Layers');
  const field = element('input', { type: 'text' });
  const root = element('div', {}, made.play, made.slider);
  document.body.append(root, other, field);
  made.join(root);
  made.render(false, 50);
  return { made, handlers, root, other, field };
}

function press(key: string, on: Element = document.body, more: KeyboardEventInit = {}): boolean {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...more });
  on.dispatchEvent(event);
  return event.defaultPrevented;
}

afterEach(() => {
  // Hidden, a transport no longer takes the keys: each test starts with none shown.
  for (const child of [...document.body.children]) (child as HTMLElement).hidden = true;
  document.body.replaceChildren();
});

describe('a transport’s Play button', () => {
  it('is drawn as a glyph, and named for what a press does', () => {
    const { made } = transport();
    expect(made.play.textContent).toBe('▶');
    expect(made.play.getAttribute('aria-label')).toBe('Play');
    made.render(true);
    expect(made.play.textContent).toBe('❚❚');
    expect(made.play.getAttribute('aria-label')).toBe('Pause');
  });

  it('is not written again each frame it stays the same (#1187)', () => {
    const { made } = transport();
    made.render(true, 10);
    const glyph = made.play.firstChild;
    const observer = new MutationObserver(() => undefined);
    observer.observe(made.play, { attributes: true, childList: true, subtree: true });
    made.render(true, 11);
    made.render(true, 12);
    expect(observer.takeRecords()).toEqual([]);
    observer.disconnect();
    expect(made.play.firstChild).toBe(glyph);
  });

  it('takes the words of what it plays, and any more attributes', () => {
    const made = createTransport(
      {
        play: {
          className: 'play',
          words: { play: 'Travel', pause: 'Stop' },
          attributes: { 'data-testid': 'travel' },
        },
        slider: {},
      },
      { onPlay: vi.fn(), onSlide: vi.fn() },
    );
    expect(made.play.getAttribute('aria-label')).toBe('Travel');
    expect(made.play.dataset['testid']).toBe('travel');
    made.render(true);
    expect(made.play.getAttribute('aria-label')).toBe('Stop');
  });

  it('a press asks for the other of playing and paused', () => {
    const { made, handlers } = transport();
    made.play.click();
    expect(handlers.onPlay).toHaveBeenLastCalledWith(true);
    made.render(true);
    made.play.click();
    expect(handlers.onPlay).toHaveBeenLastCalledWith(false);
  });
});

describe('a story’s Play button and the keys', () => {
  function story() {
    const onPlay = vi.fn();
    const step = vi.fn();
    const play = createStoryPlay('story-play', onPlay);
    const root = element('section', {}, play.button);
    document.body.append(root);
    play.join(root, step);
    return { play, onPlay, step, root };
  }

  it('says Pause, playing from the start, and Play once paused', () => {
    const { play } = story();
    expect(play.button.textContent).toBe('Pause');
    expect(play.button.hasAttribute('aria-label')).toBe(false);
    play.set(false);
    expect(play.playing).toBe(false);
    expect(play.button.textContent).toBe('Play');
  });

  it('Space pauses it, and the arrows are steps of its own', () => {
    const { onPlay, step } = story();
    press(' ');
    expect(onPlay).toHaveBeenLastCalledWith(false);
    press('ArrowLeft');
    expect(step).toHaveBeenLastCalledWith(-1, false);
    press('ArrowRight', document.body, { shiftKey: true });
    expect(step).toHaveBeenLastCalledWith(1, true);
  });

  it('with its button hidden, as when the steps wait for the reader, the arrows still step', () => {
    const { play, onPlay, step } = story();
    play.button.hidden = true;
    press(' ');
    expect(onPlay).not.toHaveBeenCalled();
    press('ArrowRight');
    expect(step).toHaveBeenLastCalledWith(1, false);
  });

  it('laid over the page, it takes the keys before a transport beneath, whichever came first', () => {
    const over = story();
    const beneath = transport();
    press('ArrowRight');
    expect(over.step).toHaveBeenLastCalledWith(1, false);
    expect(beneath.handlers.onSlide).not.toHaveBeenCalled();
    over.root.hidden = true;
    press('ArrowRight');
    expect(beneath.handlers.onSlide).toHaveBeenLastCalledWith(51);
  });
});

describe('a transport and the keys', () => {
  it('Space plays, and pauses once it shows playing', () => {
    const { made, handlers } = transport();
    expect(press(' ')).toBe(true);
    expect(handlers.onPlay).toHaveBeenLastCalledWith(true);
    made.render(true);
    press(' ');
    expect(handlers.onPlay).toHaveBeenLastCalledWith(false);
  });

  it('the arrows step the slider by its own step, and tell it as a drag would', () => {
    const { made, handlers } = transport();
    expect(press('ArrowRight')).toBe(true);
    expect(handlers.onSlide).toHaveBeenLastCalledWith(51);
    press('ArrowLeft');
    press('ArrowLeft');
    expect(handlers.onSlide).toHaveBeenLastCalledWith(49);
    expect(made.slider.value).toBe('49');
  });

  it('with Shift an arrow leaps ten steps', () => {
    const { handlers } = transport();
    press('ArrowRight', document.body, { shiftKey: true });
    expect(handlers.onSlide).toHaveBeenLastCalledWith(60);
  });

  it('a slider with no step of its own moves by one, or half with a step of a half', () => {
    const any = transport({ min: '0', max: '100', step: 'any' });
    press('ArrowRight');
    expect(any.handlers.onSlide).toHaveBeenLastCalledWith(51);
    any.root.hidden = true;
    const half = transport({ min: '0', max: '100', step: '0.5' });
    press('ArrowLeft');
    expect(half.handlers.onSlide).toHaveBeenLastCalledWith(49.5);
  });

  it('at the slider’s end an arrow does nothing more', () => {
    const { made, handlers } = transport();
    made.render(false, 100);
    press('ArrowRight');
    expect(handlers.onSlide).not.toHaveBeenCalled();
    made.render(false, 95);
    press('ArrowRight', document.body, { shiftKey: true });
    expect(handlers.onSlide).toHaveBeenLastCalledWith(100);
  });

  it('Space on a button the keyboard reached is that button’s; an arrow there still steps', () => {
    const { handlers, other } = transport();
    press('Tab');
    other.focus();
    expect(press(' ', other)).toBe(false);
    expect(handlers.onPlay).not.toHaveBeenCalled();
    press('ArrowRight', other);
    expect(handlers.onSlide).toHaveBeenLastCalledWith(51);
  });

  it('Space on a button only clicked, or focused by a sheet as it opened, still plays', () => {
    const { handlers, other } = transport();
    press('Tab');
    other.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    other.focus();
    expect(press(' ', other)).toBe(true);
    expect(handlers.onPlay).toHaveBeenLastCalledWith(true);
  });

  it('keys typed in a field stay in the field', () => {
    const { handlers, field } = transport();
    expect(press(' ', field)).toBe(false);
    expect(press('ArrowLeft', field)).toBe(false);
    expect(handlers.onPlay).not.toHaveBeenCalled();
    expect(handlers.onSlide).not.toHaveBeenCalled();
  });

  it('on the slider itself the arrows are the slider’s own, and Space still plays', () => {
    const { made, handlers } = transport();
    expect(press('ArrowRight', made.slider)).toBe(false);
    expect(handlers.onSlide).not.toHaveBeenCalled();
    press(' ', made.slider);
    expect(handlers.onPlay).toHaveBeenLastCalledWith(true);
  });

  it('a key something else has used is left alone', () => {
    const { handlers, other } = transport();
    other.addEventListener('keydown', (event) => {
      event.preventDefault();
    });
    press('ArrowRight', other);
    expect(handlers.onSlide).not.toHaveBeenCalled();
  });

  it('hidden, it takes no keys, and the page keeps them', () => {
    const { handlers, root } = transport();
    root.hidden = true;
    expect(press(' ')).toBe(false);
    expect(press('ArrowRight')).toBe(false);
    expect(handlers.onPlay).not.toHaveBeenCalled();
    expect(handlers.onSlide).not.toHaveBeenCalled();
  });

  it('of two shown, the keys go to the one holding the focus', () => {
    const first = transport();
    const second = transport();
    press('ArrowRight', first.made.play);
    expect(first.handlers.onSlide).toHaveBeenLastCalledWith(51);
    expect(second.handlers.onSlide).not.toHaveBeenCalled();
  });
});

describe('a transport shown', () => {
  it('follows where play has got to', () => {
    const { made } = transport();
    made.render(true, 70);
    expect(made.playing).toBe(true);
    expect(made.slider.value).toBe('70');
  });

  it('a slider the reader holds is not moved under them, unless it is playing', () => {
    const { made } = transport();
    made.slider.focus();
    made.render(false, 70);
    expect(made.slider.value).toBe('50');
    made.render(true, 70);
    expect(made.slider.value).toBe('70');
  });
});
