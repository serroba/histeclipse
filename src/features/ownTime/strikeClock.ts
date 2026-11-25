/**
 * The strike clock's panel (#1173): an impact in its own time, laid over the page. It says how
 * long before or after the strike the moment is, what was happening then and whose studies say
 * so, and plays the clock on the shared transport: Play and Pause, a slider over log time, and
 * the keys (Space, the arrows; #807). It keeps no globe of its own: it tells `onMoment` the
 * seconds since the strike, each frame it plays and each time it is moved.
 */

import type { ClockScale } from '../../deepTime/clockScale';
import { STRIKE_SCALE } from '../../deepTime/strikeClock';
import { DEFAULT_PACE, PACE_LABELS, PACES, type Pace } from '../../deepTime/playSpeed';
import { element } from '../../ui/dom';
import { setText } from '../../util/pageWrites';
import { createTransport, type Transport } from '../../ui/transport';
import { phaseAt, type EventPhase } from './phases';
import './strikeClock.css';

export interface StrikeClockOptions {
  /** What it is called: "Chicxulub, in its own time". */
  readonly title: string;
  readonly phases: readonly EventPhase[];
  /** How its slider runs: Chicxulub's log seconds unless said (#1191). */
  readonly scale?: ClockScale;
  /** The moment changed: `seconds` since the event. */
  onMoment(seconds: number): void;
  /** The reader closed it. */
  onClose(): void;
  /** It played to its end (#1218); left out, it waits there to be played again or closed. */
  onEnd?(): void;
}

export interface StrikeClock {
  readonly root: HTMLElement;
  /** Open it playing, at the approach or at `seconds` since the event (#1218). */
  open(seconds?: number): void;
  /** Close it, as the reader does. */
  close(): void;
  readonly isOpen: () => boolean;
}

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

/** The panel round `transport`, called `title`, the marks of `scale` under the slider. */
function clockView(title: string, scale: ClockScale, transport: Transport): ClockView {
  const speed = element(
    'select',
    { class: 'strike-clock-speed', 'aria-label': 'Speed' },
    ...PACES.map((each) => element('option', { value: each }, PACE_LABELS[each])),
  );
  speed.value = DEFAULT_PACE;
  const marks = element(
    'ol',
    { class: 'strike-clock-marks', 'aria-hidden': 'true' },
    ...scale.marks.map(([seconds, label]) => {
      const mark = element('li', {}, label);
      mark.style.left = `${String((100 * scale.positionAt(seconds)) / scale.end)}%`;
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
    element('p', { class: 'strike-clock-hint' }, scale.hint),
    element('div', { class: 'strike-clock-controls' }, transport.play, speed),
  );
  return { root, speed, closeButton, ...view };
}

/**
 * Say the moment `seconds` since the strike, and the phase then, with its sources. Called every
 * frame while it plays: the phase's words and links are written only when the phase changes,
 * and the moment only when its words do (#1187).
 */
function showMoment(
  view: ClockView,
  scale: ClockScale,
  seconds: number,
  phase: EventPhase | undefined,
): void {
  setText(view.when, scale.text(seconds));
  const shown = String(Math.round(seconds));
  if (view.root.dataset['seconds'] !== shown) view.root.dataset['seconds'] = shown;
  const id = phase?.id ?? '';
  if (view.root.dataset['phase'] === id) return;
  view.root.dataset['phase'] = id;
  setText(view.phaseTitle, phase?.title ?? '');
  setText(view.phaseText, phase?.text ?? '');
  view.sources.replaceChildren(
    ...(phase?.sources ?? []).flatMap((source, index) => [
      ...(index > 0 ? [' · '] : []),
      element('a', { href: source.url, target: '_blank', rel: 'noopener' }, source.name),
    ]),
  );
}

export function createStrikeClock(options: StrikeClockOptions): StrikeClock {
  const scale = options.scale ?? STRIKE_SCALE;
  let position = 0;
  let frame: number | null = null;
  let last: number | null = null;

  const transport = createTransport(
    {
      play: { className: 'strike-clock-play' },
      slider: {
        class: 'strike-clock-range',
        min: '0',
        max: String(scale.end),
        step: String(scale.step),
        'aria-label': scale.label,
      },
      over: true,
    },
    {
      onPlay(play) {
        (play ? start : stop)();
      },
      onSlide(value) {
        stop();
        moveTo(value);
      },
    },
  );
  const view = clockView(options.title, scale, transport);
  const { root, speed } = view;
  view.closeButton.addEventListener('click', close);
  transport.join(root);

  /** Show the moment at `next` on the slider, and tell whoever draws it. */
  function moveTo(next: number): void {
    position = Math.min(scale.end, Math.max(0, next));
    const seconds = scale.secondsAt(position);
    showMoment(view, scale, seconds, phaseAt(options.phases, seconds));
    transport.render(frame !== null, position);
    options.onMoment(seconds);
  }

  function tick(now: number): void {
    // A late frame moves it on by at most a fifth of a second: a hitch pauses it, never skips.
    const seconds = last === null ? 0 : Math.min(0.2, (now - last) / 1000);
    last = now;
    // At the scale's own pace there: Chicxulub's slower over the approach, faster once the sky
    // has cleared (#1187).
    moveTo(position + scale.advance(speed.value as Pace, seconds, position));
    if (position >= scale.end) {
      stop();
      options.onEnd?.();
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  function start(): void {
    if (frame !== null) return;
    if (position >= scale.end) position = 0;
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
    open(seconds) {
      root.hidden = false;
      moveTo(seconds === undefined ? 0 : scale.positionAt(seconds));
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
