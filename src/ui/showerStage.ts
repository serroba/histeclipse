/**
 * The stage for the carbon-14 shower (#282): while it plays the panels step aside, and the reader
 * has its caption, where it is among the steps, and controls to go back, pause or play, go on,
 * replay and close. Keys while it is open: space plays or pauses, the arrows step, Escape closes.
 *
 * DOM glue, covered by the Playwright suite; the steps are in `globe/showerSteps.ts`.
 */

import type { ShowerCommand, ShowerState } from '../globe/showerAnimation';
import { SHOWER_STEPS, type ShowerStep } from '../globe/showerSteps';
import { element } from './dom';
import { reactionDiagram } from './reactionDiagram';

const STEP_NAMES: Readonly<Record<ShowerStep, string>> = {
  rays: 'Cosmic rays',
  shower: 'The shower',
  capture: 'Carbon-14 made',
  dioxide: 'Carbon dioxide',
  fall: 'Falling',
  plant: 'Taken in',
};

export interface ShowerStage {
  readonly root: HTMLElement;
  /** Open it; under reduced motion the steps wait for the reader rather than play. */
  open(reducedMotion: boolean): void;
  close(): void;
  readonly isOpen: boolean;
  /** Show the state the shower reports, with the step's caption. */
  render(state: ShowerState, caption: string): void;
}

export function createShowerStage(
  onCommand: (command: ShowerCommand | 'stop') => void,
): ShowerStage {
  let reduced = false;
  let playing = true;
  // The chemistry, drawn, for the steps where it happens.
  const diagram = element('div', { class: 'shower-diagram' });
  let drawnFor: ShowerStep | null = null;
  const caption = element('p', {
    class: 'shower-caption',
    'data-testid': 'shower-caption',
    'aria-live': 'polite',
  });
  const dots = element(
    'ol',
    { class: 'shower-dots', 'aria-label': 'Steps' },
    ...SHOWER_STEPS.map(({ step }) =>
      element('li', { 'data-step': step, title: STEP_NAMES[step] }, STEP_NAMES[step]),
    ),
  );
  const button = (label: string, run: () => void): HTMLButtonElement => {
    const made = element('button', { type: 'button', class: 'shower-control' }, label);
    made.addEventListener('click', run);
    return made;
  };
  const back = button('Back', () => {
    step('back');
  });
  const toggle = button('Pause', () => {
    onCommand(playing ? 'pause' : 'play');
  });
  const next = button('Next', () => {
    step('next');
  });
  const replay = button('Replay', () => {
    onCommand('replay');
    if (reduced) onCommand('settle');
  });
  const close = button('Close', () => {
    onCommand('stop');
  });
  const root = element(
    'section',
    { class: 'shower-stage', 'aria-label': 'How carbon-14 is made, step by step', hidden: '' },
    diagram,
    caption,
    dots,
    element('div', { class: 'shower-controls' }, back, toggle, next, replay, close),
  );

  /** Step back or on; under reduced motion, straight to the step's finished picture. */
  function step(command: 'back' | 'next'): void {
    onCommand(command);
    if (reduced) onCommand('settle');
  }

  document.addEventListener('keydown', (event) => {
    if (root.hasAttribute('hidden') || event.defaultPrevented) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
    const keys: Record<string, () => void> = {
      ' ': () => {
        if (!reduced) onCommand(playing ? 'pause' : 'play');
      },
      ArrowLeft: () => {
        step('back');
      },
      ArrowRight: () => {
        step('next');
      },
      Escape: () => {
        onCommand('stop');
      },
    };
    const run = keys[event.key];
    if (run === undefined) return;
    event.preventDefault();
    run();
  });

  return {
    root,
    open(reducedMotion) {
      reduced = reducedMotion;
      toggle.hidden = reduced;
      root.hidden = false;
      document.documentElement.classList.add('is-explaining');
    },
    close() {
      root.hidden = true;
      caption.textContent = '';
      drawnFor = null;
      document.documentElement.classList.remove('is-explaining');
    },
    get isOpen() {
      return !root.hasAttribute('hidden');
    },
    render(state, text) {
      playing = state.playing;
      caption.textContent = text;
      if (drawnFor !== state.step) {
        drawnFor = state.step;
        const drawn = reactionDiagram(state.step);
        diagram.replaceChildren(...(drawn === null ? [] : [drawn]));
        diagram.hidden = drawn === null;
      }
      toggle.textContent = state.playing ? 'Pause' : 'Play';
      root.dataset['step'] = state.step;
      root.dataset['playing'] = String(state.playing);
      const index = SHOWER_STEPS.findIndex(({ step: each }) => each === state.step);
      for (const [i, dot] of [...dots.children].entries()) {
        dot.classList.toggle('is-done', i < index);
        if (i === index) dot.setAttribute('aria-current', 'step');
        else dot.removeAttribute('aria-current');
      }
      back.disabled = index === 0 && !state.ended;
      next.disabled = index === SHOWER_STEPS.length - 1;
    },
  };
}
