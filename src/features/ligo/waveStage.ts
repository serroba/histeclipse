/**
 * The stage under the wave (#829, #831): what is shown, where the wave is, how far the drawing
 * is from the truth, and the controls. Two chapters, picked here: space and its ring of masses,
 * or LIGO Livingston with what both detectors measured plotted beneath. The sound is offered,
 * never played unasked, and says how it was changed to be heard.
 *
 * DOM glue; the part (`index.ts`) says what each control does.
 */

import { element } from '../../ui/dom';
import { createStoryPlay, type StoryPlay } from '../../ui/transport';
import { SOUND_NOTE } from './chirpSound';
import { SCALE_NOTE } from './wavePlay';
import type { WaveChapter } from './waveScene';

const ABOUT: Readonly<Record<WaveChapter, string>> = {
  space:
    'A ring of free masses, as a gravitational wave from two black holes merging 1.3 billion light-years away comes through it toward you. Space itself stretches one way and squeezes the other, then the other way round, faster and harder as the black holes spiral together, and rings as the one they make settles. Behind the ring, the space the wave has already crossed.',
  detector:
    'LIGO Livingston, Louisiana (30.56° N, 90.77° W), seen from above, north at the top: two arms 4 km long at right angles, laser light running along each to a mirror and back. The wave stretched one arm as it shrank the other, by the strain the detector measured; where the two beams meet again, the light, held dark while the arms are equal, brightens as they differ. LIGO Hanford, Washington (46.46° N, 119.41° W), heard it 6.9 ms later.',
};

const CHAPTER_NAMES: Readonly<Record<WaveChapter, string>> = {
  space: 'Space',
  detector: 'At Livingston',
};

export interface StageControls {
  readonly onPlay: (playing: boolean) => void;
  readonly restart: () => void;
  readonly close: () => void;
  readonly about: () => void;
  readonly chapter: (chapter: WaveChapter) => void;
  readonly hear: () => void;
}

export interface WaveStage {
  readonly root: HTMLElement;
  readonly moment: HTMLElement;
  readonly play: StoryPlay;
  /** Show what goes with a chapter: its words, its button pressed, the plot with the detector. */
  showChapter(chapter: WaveChapter): void;
  /** Put the plot of what was measured in its place, once it has loaded. */
  setPlot(plot: HTMLElement): void;
}

function button(label: string, run: () => void): HTMLButtonElement {
  const made = element('button', { type: 'button', class: 'wave-control' }, label);
  made.addEventListener('click', run);
  return made;
}

export function createWaveStage(why: HTMLElement, controls: StageControls): WaveStage {
  const moment = element('p', { class: 'wave-moment', 'data-testid': 'wave-moment' });
  const about = element('p', { class: 'wave-about' });
  const plotSlot = element('div', { class: 'wave-plot', hidden: '' });
  const play = createStoryPlay('wave-control', (playing) => {
    play.set(playing);
    controls.onPlay(playing);
  });
  const chapters = (['space', 'detector'] as const).map((chapter) => {
    const made = button(CHAPTER_NAMES[chapter], () => {
      controls.chapter(chapter);
    });
    made.classList.add('wave-chapter');
    return { chapter, made };
  });
  const root = element(
    'section',
    { class: 'wave-stage', 'aria-label': 'A gravitational wave passing', hidden: '' },
    element('h2', { class: 'wave-title' }, 'GW150914: space stretched by a passing wave'),
    element(
      'div',
      { class: 'wave-chapters', role: 'group', 'aria-label': 'What to show' },
      ...chapters.map(({ made }) => made),
    ),
    about,
    plotSlot,
    moment,
    element('p', { class: 'wave-scale', 'data-testid': 'wave-scale' }, SCALE_NOTE),
    element(
      'div',
      { class: 'wave-controls' },
      play.button,
      button('Start again', controls.restart),
      button('Hear it', controls.hear),
      button('About GW150914', controls.about),
      why,
      button('Close', controls.close),
    ),
    element(
      'p',
      { class: 'wave-sound-note' },
      `“Hear it” plays the chirp ${SOUND_NOTE.charAt(0).toLowerCase()}${SOUND_NOTE.slice(1)}`,
    ),
  );
  play.join(root, () => undefined);
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
      about.textContent = ABOUT[shown];
      for (const { chapter, made } of chapters) {
        made.setAttribute('aria-pressed', String(chapter === shown));
      }
      plotSlot.hidden = shown !== 'detector';
      root.dataset['chapter'] = shown;
    },
    setPlot(plot) {
      plotSlot.replaceChildren(plot);
    },
  };
}
