/**
 * The stage under the wave (#829, #831, #833, #990): what is shown, where the wave is, how far the
 * drawing is from the truth, and the controls, for whichever wave is told (`events.ts`). The story's chapters, picked here or stepped
 * through (the arrow keys step too): its source, its journey, space and its ring of masses, and
 * LIGO Livingston with what both detectors measured plotted beneath. The sound is offered,
 * never played unasked, and says how it was changed to be heard.
 *
 * DOM glue; the part (`index.ts`) says what each control does.
 */

import { element } from '../../ui/dom';
import { createStoryPlay, type StoryPlay } from '../../ui/transport';
import type { WaveEvent } from './events';
import { WAVE_CHAPTERS, type WaveChapter } from '../../state/slices/display';

const CHAPTER_NAMES: Readonly<Record<WaveChapter, string>> = {
  source: 'The source',
  journey: 'The journey',
  space: 'Space',
  detector: 'At Livingston',
};

export interface StageControls {
  readonly onPlay: (playing: boolean) => void;
  readonly restart: () => void;
  readonly close: () => void;
  readonly about: () => void;
  readonly chapter: (chapter: WaveChapter) => void;
  /** Step to the chapter before or after the one shown. */
  readonly step: (direction: -1 | 1) => void;
  readonly hear: () => void;
}

export interface WaveStage {
  readonly root: HTMLElement;
  readonly moment: HTMLElement;
  readonly play: StoryPlay;
  /** Show what goes with a chapter: its words, its button pressed, the plot with the detector. */
  showChapter(chapter: WaveChapter): void;
  /** Put the plot of what was measured in its place, once it has loaded; null for none. */
  setPlot(plot: HTMLElement | null): void;
  /** Tell the story of `event`: its title, its chapters, its words. */
  setEvent(event: WaveEvent): void;
}

function button(label: string, run: () => void): HTMLButtonElement {
  const made = element('button', { type: 'button', class: 'wave-control' }, label);
  made.addEventListener('click', run);
  return made;
}

/** What the stage says that is the wave's own: its title, scale, sound and card's button. */
function eventWords(about: () => void): {
  readonly title: HTMLElement;
  readonly scale: HTMLElement;
  readonly soundNote: HTMLElement;
  readonly aboutButton: HTMLButtonElement;
  readonly tell: (event: WaveEvent) => void;
} {
  const words = {
    title: element('h2', { class: 'wave-title' }),
    scale: element('p', { class: 'wave-scale', 'data-testid': 'wave-scale' }),
    soundNote: element('p', { class: 'wave-sound-note' }),
    aboutButton: button('About', about),
    tell: (event: WaveEvent): void => {
      words.title.textContent = event.title;
      words.scale.textContent = event.scaleNote;
      const note = event.sound.note;
      words.soundNote.textContent = `“Hear it” plays the chirp ${note.charAt(0).toLowerCase()}${note.slice(1)}`;
      words.aboutButton.textContent = `About ${event.name}`;
    },
  };
  return words;
}

export function createWaveStage(why: HTMLElement, controls: StageControls): WaveStage {
  const moment = element('p', { class: 'wave-moment', 'data-testid': 'wave-moment' });
  const about = element('p', { class: 'wave-about' });
  const plotSlot = element('div', { class: 'wave-plot', hidden: '' });
  const play = createStoryPlay('wave-control', (playing) => {
    play.set(playing);
    controls.onPlay(playing);
  });
  const chapters = WAVE_CHAPTERS.map((chapter) => {
    const made = button(CHAPTER_NAMES[chapter], () => {
      controls.chapter(chapter);
    });
    made.classList.add('wave-chapter');
    return { chapter, made };
  });
  const { title, scale, soundNote, aboutButton, tell } = eventWords(controls.about);
  let told: WaveEvent | null = null;
  const root = element(
    'section',
    { class: 'wave-stage', 'aria-label': 'A gravitational wave passing', hidden: '' },
    title,
    element(
      'div',
      { class: 'wave-chapters', role: 'group', 'aria-label': 'What to show' },
      ...chapters.map(({ made }) => made),
    ),
    about,
    plotSlot,
    moment,
    scale,
    element(
      'div',
      { class: 'wave-controls' },
      button('Back', () => {
        controls.step(-1);
      }),
      play.button,
      button('Next', () => {
        controls.step(1);
      }),
      button('Start again', controls.restart),
      button('Hear it', controls.hear),
      aboutButton,
      why,
      button('Close', controls.close),
    ),
    soundNote,
  );
  play.join(root, (direction) => {
    controls.step(direction);
  });
  document.addEventListener('keydown', (event) => {
    if (root.hasAttribute('hidden') || event.defaultPrevented || event.key !== 'Escape') return;
    event.preventDefault();
    controls.close();
  });
  return {
    root,
    moment,
    play,
    showChapter(shown) {
      about.textContent = told?.about[shown] ?? '';
      for (const { chapter, made } of chapters) {
        made.setAttribute('aria-pressed', String(chapter === shown));
      }
      plotSlot.hidden = shown !== 'detector' || plotSlot.childElementCount === 0;
      root.dataset['chapter'] = shown;
    },
    setPlot(plot) {
      plotSlot.replaceChildren(...(plot === null ? [] : [plot]));
      plotSlot.hidden = root.dataset['chapter'] !== 'detector' || plot === null;
    },
    setEvent(event) {
      told = event;
      tell(event);
      root.dataset['wave'] = event.id;
      for (const { chapter, made } of chapters) made.hidden = !event.chapters.includes(chapter);
    },
  };
}
