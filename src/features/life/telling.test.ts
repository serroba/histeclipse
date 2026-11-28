import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { parseLife } from '../../data/lifeStories';
import { storyOf, type Story } from './story';
import {
  BEGIN_PAUSE_MS,
  createTelling,
  STORY_SECONDS,
  storySpeed,
  type TellingContext,
} from './telling';

const mammals = parseLife(
  JSON.parse(readFileSync('public/data/life-stories/mammals.json', 'utf8')),
);

function story(name: string): Story {
  const node = mammals.nodes.find((each) => each.name === name);
  const told = storyOf(mammals, node?.pbdb ?? -1, null);
  if (told === null) throw new Error(`no story for ${name}`);
  return told;
}

const cats = story('Felidae');

/** A page as the telling sees it: where it is, whether it plays, and what was asked of it. */
function page(start: { ma: number | null; pbdb: number | null; playing?: boolean }) {
  const now = { ...start };
  const waiting: { run: () => void; ms: number }[] = [];
  const context = {
    enter: vi.fn((ma: number) => {
      now.ma = ma;
    }),
    play: vi.fn<(ma: number, maPerSecond: number) => void>(),
    playing: () => start.playing === true,
    flyTo: vi.fn<TellingContext['flyTo']>(),
    warmth: vi.fn<() => void>(),
    now: () => now,
    after: (run: () => void, ms: number) => {
      waiting.push({ run, ms });
    },
  } satisfies TellingContext;
  return { context, now, waiting, telling: createTelling(context) };
}

describe('telling an animal’s story', () => {
  it('plays in about the same time whatever its length, and never slower than a floor', () => {
    expect(storySpeed(cats)).toBeCloseTo(30 / STORY_SECONDS, 6);
    expect(storySpeed(story('Mammalia'))).toBeGreaterThan(storySpeed(cats));
    expect(storySpeed(story('Eohippus'))).toBe(0.2);
  });

  it('opens at its oldest finds, the globe turned to them and coloured by warmth', () => {
    const { context, telling } = page({ ma: null, pbdb: cats.clade.pbdb });
    telling.begin(cats);
    expect(context.enter).toHaveBeenCalledWith(30);
    expect(context.warmth).toHaveBeenCalledOnce();
    expect(context.flyTo).toHaveBeenCalledWith(cats.chapters[0]?.where);
    expect(context.play).not.toHaveBeenCalled();
  });

  it('then plays, after a moment to take it in', () => {
    const { context, telling, waiting } = page({ ma: null, pbdb: cats.clade.pbdb });
    telling.begin(cats);
    expect(waiting.map((each) => each.ms)).toEqual([BEGIN_PAUSE_MS]);
    waiting[0]?.run();
    expect(context.play).toHaveBeenCalledWith(30, storySpeed(cats));
  });

  it('does not play if the reader went elsewhere meanwhile, in time or to another story', () => {
    const moved = page({ ma: null, pbdb: cats.clade.pbdb });
    moved.telling.begin(cats);
    moved.now.ma = 12;
    moved.waiting[0]?.run();
    expect(moved.context.play).not.toHaveBeenCalled();

    const other = page({ ma: null, pbdb: cats.clade.pbdb });
    other.telling.begin(cats);
    other.now.pbdb = 1;
    other.waiting[0]?.run();
    expect(other.context.play).not.toHaveBeenCalled();
  });

  it('plays on from where the reader is inside the story, else from its start', () => {
    const inside = page({ ma: 12, pbdb: cats.clade.pbdb });
    inside.telling.play(cats);
    expect(inside.context.play).toHaveBeenCalledWith(12, storySpeed(cats));
    for (const ma of [null, 0, 200]) {
      const outside = page({ ma, pbdb: cats.clade.pbdb });
      outside.telling.play(cats);
      expect(outside.context.play).toHaveBeenCalledWith(30, storySpeed(cats));
    }
  });

  it('plays from the start when asked while it plays', () => {
    const { context, telling } = page({ ma: 12, pbdb: cats.clade.pbdb, playing: true });
    telling.play(cats);
    expect(context.play).toHaveBeenCalledWith(30, storySpeed(cats));
  });

  it('turns the globe to each moment’s place as its step comes, once, while it plays', () => {
    const { context, telling } = page({ ma: 30, pbdb: cats.clade.pbdb, playing: true });
    const europe = cats.chapters.find((chapter) => chapter.title === 'First found in Europe');
    telling.follow(cats, europe?.ma ?? 0);
    telling.follow(cats, europe?.ma ?? 0);
    expect(context.flyTo).toHaveBeenCalledTimes(1);
    expect(context.flyTo).toHaveBeenCalledWith(europe?.where);
    // A step that is no moment's turns nothing.
    telling.follow(cats, 1000);
    expect(context.flyTo).toHaveBeenCalledTimes(1);
  });

  it('leaves the globe alone while the story stands', () => {
    const { context, telling } = page({ ma: 30, pbdb: cats.clade.pbdb });
    telling.follow(cats, 25);
    expect(context.flyTo).not.toHaveBeenCalled();
  });
});
