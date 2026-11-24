/**
 * The strike clock's panel (#1173): an impact in its own time, laid over the page. It says how
 * long before or after the strike the moment is, what was happening then and whose studies say
 * so, and plays the clock on the shared transport: Play and Pause, a slider over log time, and
 * the keys (Space, the arrows; #807). It keeps no globe of its own: it tells `onMoment` the
 * seconds since the strike, each frame it plays and each time it is moved.
 */

import {
  clockStep,
  clockText,
  CLOCK_END,
  positionAt,
  secondsAt,
  STRIKE_AT,
} from '../../deepTime/strikeClock';
import { DEFAULT_PACE, PACE_LABELS, PACES, type Pace } from '../../deepTime/playSpeed';
import { element } from '../../ui/dom';
import { createTransport, type Transport } from '../../ui/transport';
import { phaseAt, type StrikePhase } from './strikePhases';
import './strikeClock.css';

export interface StrikeClockOptions {
  /** What it is called: "Chicxulub, in its own time". */
  readonly title: string;
  readonly phases: readonly StrikePhase[];
  /** The moment changed: `seconds` since the strike. */
  onMoment(seconds: number): void;
  /** The reader closed it. */
  onClose(): void;
}

export interface StrikeClock {
  readonly root: HTMLElement;
  /** Open it at the approach, playing. */
  open(): void;
  /** Close it, as the reader does. */
  close(): void;
  readonly isOpen: () => boolean;
}

/**
 * The marks under the slider: where some of the tenfolds begin. Not the minute: on a phone it
 * would sit on the strike's mark.
 */
const MARKS: readonly (readonly [number, string])[] = [
  [0, 'Strike'],
  [3600, 'Hour'],
  [86_400, 'Day'],
  [365.25 * 86_400, 'Year'],
  [1000 * 365.25 * 86_400, '1,000 years'],
  [1e6 * 365.25 * 86_400, '1 Myr'],
];

/** Moving one step of the slider by a key: a fifth of a tenfold. */
const STEP = 0.2;

/** The panel's parts: what it says, and its controls about the transport's. */
interface ClockView {
  readonly root: HTMLElement;
  readonly when: HTMLElement;
  readonly phaseTitle: HTMLElement;
  readonly phaseText: HTMLElement;
  readonly sources: HTMLElement;
  readonly speed: HTMLSelectElement;
  readonly closeButton: HTMLButtonElement;
}

/** The panel round `transport`, called `title`, its marks under the slider. */
function clockView(title: string, transport: Transport): ClockView {
  const speed = element(
    'select',
    { class: 'strike-clock-speed', 'aria-label': 'Speed' },
    ...PACES.map((each) => element('option', { value: each }, PACE_LABELS[each])),
  );
  speed.value = DEFAULT_PACE;
  const marks = element(
    'ol',
    { class: 'strike-clock-marks', 'aria-hidden': 'true' },
    ...MARKS.map(([seconds, label]) => {
      const mark = element('li', {}, label);
      mark.style.left = `${String((100 * positionAt(seconds)) / CLOCK_END)}%`;
      return mark;
    }),
  );
  const closeButton = element(
    'button',
    { type: 'button', class: 'strike-clock-close', 'aria-label': 'Close' },
    '×',
  );
  const view = {
    when: element('p', { class: 'strike-clock-when', 'aria-live': 'polite' }),
    phaseTitle: element('h3', { class: 'strike-clock-phase' }),
    phaseText: element('p', { class: 'strike-clock-text' }),
    sources: element('p', { class: 'strike-clock-sources' }),
  };
  const root = element(
    'section',
    { class: 'strike-clock', role: 'dialog', 'aria-label': title, hidden: '' },
    element('header', {}, element('h2', {}, title), closeButton),
    view.when,
    view.phaseTitle,
    view.phaseText,
    view.sources,
    element('div', { class: 'strike-clock-track' }, transport.slider, marks),
    element('div', { class: 'strike-clock-controls' }, transport.play, speed),
  );
  return { root, speed, closeButton, ...view };
}

/** Say the moment `seconds` since the strike, and the phase then, with its sources. */
function showMoment(view: ClockView, seconds: number, phase: StrikePhase | undefined): void {
  view.when.textContent = clockText(seconds);
  view.root.dataset['phase'] = phase?.id ?? '';
  view.root.dataset['seconds'] = String(Math.round(seconds));
  view.phaseTitle.textContent = phase?.title ?? '';
  view.phaseText.textContent = phase?.text ?? '';
  view.sources.replaceChildren(
    ...(phase?.sources ?? []).flatMap((source, index) => [
      ...(index > 0 ? [' · '] : []),
      element('a', { href: source.url, target: '_blank', rel: 'noopener' }, source.name),
    ]),
  );
}

export function createStrikeClock(options: StrikeClockOptions): StrikeClock {
  let position = 0;
  let frame: number | null = null;
  let last: number | null = null;

  const transport = createTransport(
    {
      play: { className: 'strike-clock-play' },
      slider: {
        class: 'strike-clock-range',
        min: '0',
        max: String(CLOCK_END),
        step: String(STEP),
        'aria-label': 'Time since the strike, each step on a tenfold more',
      },
      over: true,
    },
    {
      onPlay(play) {
        if (play) start();
        else stop();
      },
      onSlide(value) {
        stop();
        moveTo(value);
      },
    },
  );
  const view = clockView(options.title, transport);
  const { root, speed } = view;
  view.closeButton.addEventListener('click', close);
  transport.join(root);

  /** Show the moment at `next` on the slider, and tell whoever draws it. */
  function moveTo(next: number): void {
    position = Math.min(CLOCK_END, Math.max(0, next));
    const seconds = secondsAt(position);
    showMoment(view, seconds, phaseAt(options.phases, seconds));
    transport.render(frame !== null, position);
    options.onMoment(seconds);
  }

  function tick(now: number): void {
    // A late frame moves it on by at most a fifth of a second: a hitch pauses it, never skips.
    const seconds = last === null ? 0 : Math.min(0.2, (now - last) / 1000);
    last = now;
    // The approach plays at a third of the pace, so the strike can be seen coming.
    const step = clockStep(speed.value as Pace, seconds);
    moveTo(position + step * (position < STRIKE_AT ? 1 / 3 : 1));
    if (position >= CLOCK_END) {
      stop();
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  function start(): void {
    if (frame !== null) return;
    if (position >= CLOCK_END) position = 0;
    last = null;
    frame = requestAnimationFrame(tick);
    root.dataset['playing'] = 'true';
    transport.render(true, position);
  }

  function stop(): void {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    root.dataset['playing'] = 'false';
    transport.render(false, position);
  }

  function close(): void {
    if (root.hidden === true) return;
    stop();
    root.hidden = true;
    options.onClose();
  }

  return {
    root,
    open() {
      root.hidden = false;
      moveTo(0);
      start();
    },
    close,
    isOpen: () => root.hidden !== true,
  };
}

/** How long the offer to watch a strike in its own time stays, ms. */
export const OFFER_MS = 20_000;

export interface StrikeOffer {
  /** Offer `label`, taken with `accept`, for `OFFER_MS`. */
  show(label: string, accept: () => void): void;
  hide(): void;
}

/** The offer to watch a strike in its own time (#1174): a button that waits a while, then goes. */
export function createStrikeOffer(place: (element: HTMLElement) => void): StrikeOffer {
  let button: HTMLButtonElement | null = null;
  let timer: number | null = null;
  function hide(): void {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    button?.remove();
    button = null;
  }
  return {
    show(label, accept) {
      hide();
      const made = element('button', { type: 'button', class: 'strike-offer' }, label);
      made.addEventListener('click', () => {
        hide();
        accept();
      });
      button = made;
      place(made);
      timer = window.setTimeout(hide, OFFER_MS);
    },
    hide,
  };
}
