/**
 * Telling an animal's story through deep time: it opens at its oldest finds, the globe turned
 * to them and coloured by temperature, stands a moment, then plays to its end in about the same
 * time whatever its length; and as it plays, the globe turns to each moment's place.
 */

import type { GeoPoint } from '../../core/geo';
import type { Story } from './story';

/** About how long a story takes to play, seconds. */
export const STORY_SECONDS = 45;
/** How long a story stands at its oldest finds before it plays, ms. */
export const BEGIN_PAUSE_MS = 2500;
/** The slowest a story plays, millions of years a second. */
const SLOWEST = 0.2;

export interface TellingContext {
  /** Go to a moment on the whole span. */
  enter(ma: number): void;
  /** Play from a moment towards today, on the whole span. */
  play(ma: number, maPerSecond: number): void;
  playing(): boolean;
  flyTo(where: GeoPoint): void;
  /** Colour the globe by temperature. */
  warmth(): void;
  /** The moment shown, Ma, and the lineage whose story is told (its PBDB number). */
  now(): { readonly ma: number | null; readonly pbdb: number | null };
  after(run: () => void, ms: number): void;
}

export interface Telling {
  /** Open a story at its oldest finds, and after a moment to take that in, play it. */
  begin(story: Story): void;
  /** Play: from where the reader is, if inside the story and it is not playing; else its start. */
  play(story: Story): void;
  /** The step shown changed: while it plays, turn the globe to that moment's place. */
  follow(story: Story, step: number): void;
}

/** How fast a story plays, millions of years a second, to take about STORY_SECONDS. */
export function storySpeed(story: Story): number {
  const oldest = story.steps[0]?.ma ?? 0;
  const youngest = story.steps.at(-1)?.ma ?? 0;
  return Math.max(SLOWEST, Math.max(story.data.stepMa, oldest - youngest) / STORY_SECONDS);
}

export function createTelling(context: TellingContext): Telling {
  let followed: number | null = null;

  function playFrom(story: Story, ma: number): void {
    followed = null;
    context.play(ma, storySpeed(story));
  }

  return {
    begin(story) {
      const [origin] = story.chapters;
      if (origin === undefined) return;
      context.enter(origin.ma);
      context.warmth();
      if (origin.where !== null) context.flyTo(origin.where);
      context.after(() => {
        const { ma, pbdb } = context.now();
        // Still this story, and still where it opened: the reader has not gone elsewhere.
        if (pbdb === story.clade.pbdb && ma === origin.ma) playFrom(story, origin.ma);
      }, BEGIN_PAUSE_MS);
    },
    play(story) {
      const oldest = story.steps[0]?.ma ?? 0;
      const youngest = story.steps.at(-1)?.ma ?? 0;
      const { ma } = context.now();
      const inside = ma !== null && ma <= oldest && ma > youngest && !context.playing();
      playFrom(story, inside ? ma : oldest);
    },
    follow(story, step) {
      if (step === followed) return;
      followed = step;
      if (!context.playing()) return;
      const where = story.chapters.findLast(
        (chapter) => chapter.ma === step && chapter.where !== null,
      )?.where;
      if (where) context.flyTo(where);
    },
  };
}
