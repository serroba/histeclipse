/**
 * What everything that plays is played with: a Play button that turns to Pause, a slider over
 * what it plays through, and the keys (`playKeys.ts`): Space plays or pauses and the arrows
 * step, wherever the focus is. The eclipse, the years, the days, deep time and the tree through
 * time are each built from a transport, whose arrows step along its slider; a story with no
 * slider (the planetary boundaries, how carbon-14 is made) takes the button and the keys, and
 * says what a step is.
 */

import { element } from './dom';
import { playKeys } from './playKeys';

/** The button's name when pressing it plays, and when it pauses. */
interface PlayWords {
  readonly play: string;
  readonly pause: string;
}

/** What a Play button is called, unless what it plays has words of its own. */
const PLAY_WORDS: PlayWords = { play: 'Play', pause: 'Pause' };

interface PlayButtonOptions {
  readonly className: string;
  readonly words: PlayWords;
  /** Drawn as ▶ and ❚❚ with the words as its name (true), or as the words themselves. */
  readonly glyph: boolean;
  /** Whether it starts out playing. */
  readonly playing: boolean;
  /** Any more attributes. */
  readonly attributes?: Readonly<Record<string, string>> | undefined;
}

interface PlayButton {
  readonly button: HTMLButtonElement;
  readonly playing: boolean;
  /** Show it playing, or not. */
  set(playing: boolean): void;
}

/** A Play button: a press asks `onPlay` for the other of playing and paused. */
function createPlayButton(options: PlayButtonOptions, onPlay: (play: boolean) => void): PlayButton {
  const { words, glyph } = options;
  const button = element('button', {
    type: 'button',
    class: options.className,
    ...options.attributes,
  });
  let playing: boolean | null = null;
  function set(next: boolean): void {
    // Rendered every frame while playing: write only what changed (#1187).
    if (next === playing) return;
    playing = next;
    const name = next ? words.pause : words.play;
    if (glyph) {
      button.textContent = next ? '❚❚' : '▶';
      button.setAttribute('aria-label', name);
    } else button.textContent = name;
  }
  set(options.playing);
  button.addEventListener('click', () => {
    onPlay(playing !== true);
  });
  return {
    button,
    get playing() {
      return playing === true;
    },
    set,
  };
}

/** Whether `node` is on the page and drawn. */
function drawn(node: HTMLElement): boolean {
  // Hidden by the attribute, on it or around it, whatever the stylesheet then says of it.
  if (!node.isConnected || node.closest('[hidden]') !== null) return false;
  return node.checkVisibility({ visibilityProperty: true });
}

/** A step back (-1) or on (1); `leap` asks for a longer one. */
type Step = (direction: -1 | 1, leap: boolean) => void;

/**
 * Take the keys while `root` is drawn, and before any other with the focus within it: Space
 * presses `button`, where it is there to press, and the arrows `step`.
 */
function joinKeys(root: HTMLElement, button: HTMLButtonElement, step: Step, over: boolean): void {
  playKeys.add({
    shown: () => drawn(root),
    holds: (focus) => root.contains(focus),
    toggle() {
      if (drawn(button) && !button.disabled) button.click();
    },
    step,
    over,
  });
}

export interface StoryPlay extends PlayButton {
  /** Take the keys while `root` is drawn: the arrows `step`, as the story has it. */
  join(root: HTMLElement, step: Step): void;
}

/**
 * A story's Play button: in words, playing from the start, and laid over the page, so its keys
 * come before those of what plays beneath.
 */
export function createStoryPlay(className: string, onPlay: (play: boolean) => void): StoryPlay {
  const play = createPlayButton(
    { className, words: PLAY_WORDS, glyph: false, playing: true },
    onPlay,
  );
  return {
    button: play.button,
    get playing() {
      return play.playing;
    },
    set(playing) {
      play.set(playing);
    },
    join(root, step) {
      joinKeys(root, play.button, step, true);
    },
  };
}

/** How many of a slider's own steps a leap is. */
const LEAP_STEPS = 10;

/** Move `slider` a step, or a leap, and tell it so, as a drag would. */
function stepSlider(slider: HTMLInputElement, direction: -1 | 1, leap: boolean): void {
  // A slider with no step of its own ("any") moves by one: a day, a year.
  const own = Number(slider.step);
  const size = (Number.isFinite(own) && own > 0 ? own : 1) * (leap ? LEAP_STEPS : 1);
  const now = Number(slider.value);
  const next = Math.min(Number(slider.max), Math.max(Number(slider.min), now + direction * size));
  if (next === now) return;
  slider.value = String(next);
  slider.dispatchEvent(new Event('input', { bubbles: true }));
}

export interface TransportOptions {
  /** The button's class and, where it is not Play and Pause, its names. */
  readonly play: Pick<PlayButtonOptions, 'className' | 'attributes'> & {
    readonly words?: PlayWords;
  };
  /** The slider's attributes: its class and name, and its ends and step where they are fixed. */
  readonly slider: Readonly<Record<string, string>>;
  /** Whether it lies over the page (a sheet), and so takes the keys before the page's own. */
  readonly over?: boolean;
}

export interface Transport {
  readonly play: HTMLButtonElement;
  readonly slider: HTMLInputElement;
  readonly playing: boolean;
  /** Take the keys while `root` is drawn; with the focus anywhere in it, before any other. */
  join(root: HTMLElement): void;
  /** Show it playing or not, and where it has got to along the slider. */
  render(playing: boolean, value?: number): void;
}

export function createTransport(
  options: TransportOptions,
  handlers: {
    /** Play, or pause. */
    onPlay(play: boolean): void;
    /** The slider dragged, or stepped by a key, to `value`. */
    onSlide(value: number): void;
  },
): Transport {
  const { className, attributes, words = PLAY_WORDS } = options.play;
  const play = createPlayButton(
    { className, attributes, words, glyph: true, playing: false },
    (next) => {
      handlers.onPlay(next);
    },
  );
  const slider = element('input', { type: 'range', ...options.slider });
  slider.addEventListener('input', () => {
    handlers.onSlide(Number(slider.value));
  });
  return {
    play: play.button,
    slider,
    get playing() {
      return play.playing;
    },
    join(root) {
      joinKeys(
        root,
        play.button,
        (direction, leap) => {
          stepSlider(slider, direction, leap);
        },
        options.over ?? false,
      );
    },
    render(playing, value) {
      play.set(playing);
      // A slider the reader holds is theirs, and is not moved under them; playing, it follows.
      if (value !== undefined && (playing || document.activeElement !== slider))
        slider.value = String(value);
    },
  };
}
