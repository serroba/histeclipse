/**
 * An animal's story (a prototype), as a part of the page (#443): find an animal by the name a
 * reader knows, and its lineage's finds are told as a story on the globe. Deep time opens at
 * its oldest finds with the globe coloured by temperature, and plays to today: dots where its
 * kinds were found as the continents moved, the kinds that began and ended named, and beside
 * the globe a chart of where, how warm and how many, with the moments worth stopping at.
 */

import { loadLifeDoors, type LifeDoors } from '../../data/lifeDoors';
import { loadLifePictures, type LifePictures } from '../../data/lifePictures';
import { loadLife, LIFE_GROUPS, type LifeData, type LifeGroup } from '../../data/lifeStories';
import type { Globe } from '../../globe/globe';
import type { Watch } from '../../state/redraws';
import { layerTurned, type ViewState } from '../../state/viewState';
import { errorMessage } from '../../util/errors';
import type { MountedPart, PartContext } from '../part';
import { createLifeCard } from './card';
import { withDoors } from './doors';
import { createLifeFinder } from './finder';
import { lifeMarksLayer } from './marksLayer';
import { storyFor } from './names';
import { createLifePanel } from './panel';
import { marksAt, stepAt, storyOf, type Mark, type Story } from './story';
import './life.css';

/** What the story asks of the rest of the page. */
export interface LifeContext extends PartContext {
  readonly globe: Pick<Globe, 'addLayer' | 'flyTo'>;
  readonly deepTime: {
    /** Go to a moment on the whole span. */
    enter(ma: number): void;
    /** Play from a moment towards today, on the whole span. */
    play(ma: number, maPerSecond: number): void;
    playing(): boolean;
  };
}

export interface LifePart extends MountedPart {
  readonly button: HTMLElement;
  readonly dialog: HTMLElement;
}

/** About how long a story takes to play, seconds. */
const STORY_SECONDS = 45;
/** How long a story stands at its oldest finds before it plays, ms. */
const BEGIN_PAUSE_MS = 2500;

const WATCHES: Watch = (state) => [state.life, state.ma];

export function mountLife(context: LifeContext): LifePart {
  const { base, fetchJson, store } = context;
  const marks = context.globe.addLayer(lifeMarksLayer);
  const files = new Map<LifeGroup, Promise<LifeData>>();
  const loaded = new Map<LifeGroup, LifeData>();
  const failed = new Set<LifeGroup>();

  function load(group: LifeGroup): Promise<LifeData> {
    let file = files.get(group);
    if (file === undefined) {
      file = loadLife(`${base}data/life-stories/${group}.json`, fetchJson);
      files.set(group, file);
      file.then(
        (data) => {
          loaded.set(group, data);
          render(store.get());
        },
        (error: unknown) => {
          files.delete(group);
          failed.add(group);
          context.notify(`Could not load the animals’ stories: ${errorMessage(error)}`);
          render(store.get());
        },
      );
    }
    return file;
  }

  let pictures: LifePictures | null = null;
  let doors: LifeDoors | null = null;
  let picturesAsked = false;
  /** The animals' pictures, asked for once: a story is told without them until they come. */
  function wantPictures(): void {
    if (picturesAsked) return;
    picturesAsked = true;
    // The continents' doors with them: a story's moments say more once they come.
    loadLifeDoors(`${base}data/life-stories/doors.json`, fetchJson).then(
      (found) => {
        doors = found;
        panel.doors(found);
        render(store.get());
      },
      (error: unknown) => {
        context.notify(`Could not load the continents’ doors: ${errorMessage(error)}`);
      },
    );
    loadLifePictures(`${base}data/life-stories/pictures.json`, fetchJson).then(
      (loadedPictures) => {
        pictures = loadedPictures;
        panel.pictures(loadedPictures);
        render(store.get());
      },
      (error: unknown) => {
        context.notify(`Could not load the animals’ pictures: ${errorMessage(error)}`);
      },
    );
  }

  let told: { readonly key: string; readonly story: Story | null } | null = null;
  /** The story the view asks for, once its group has loaded; kept until it asks for another. */
  function storyFrom(state: ViewState): Story | null | 'loading' | 'failed' {
    const { life } = state;
    if (life === null) return null;
    wantPictures();
    const data = loaded.get(life.group);
    if (data === undefined) {
      if (failed.has(life.group)) return 'failed';
      void load(life.group).catch(() => undefined);
      return 'loading';
    }
    const key = `${life.group}:${String(life.pbdb)}:${String(life.focus)}:${String(doors !== null)}`;
    if (told?.key !== key) {
      const story = storyOf(data, life.pbdb, life.focus);
      told = { key, story: story === null || doors === null ? story : withDoors(story, doors) };
    }
    return told.story;
  }

  /** Play a story from a moment to its end, in about the same time whatever its length. */
  function play(story: Story, from: number): void {
    const [oldest] = story.steps;
    const youngest = story.steps.at(-1);
    if (oldest === undefined || youngest === undefined) return;
    const span = Math.max(story.data.stepMa, oldest.ma - youngest.ma);
    followed = null;
    context.deepTime.play(from, Math.max(0.2, span / STORY_SECONDS));
  }

  let starting: ReturnType<typeof setTimeout> | null = null;
  /**
   * Open deep time at a story's oldest finds, the globe turned to them and coloured by warmth,
   * and after a moment to take that in, play it.
   */
  function begin(story: Story): void {
    const [origin] = story.chapters;
    if (origin === undefined) return;
    context.deepTime.enter(origin.ma);
    store.set((state) => layerTurned(state, 'temperature', true));
    if (origin.where !== null) context.globe.flyTo(origin.where);
    if (starting !== null) clearTimeout(starting);
    starting = setTimeout(() => {
      starting = null;
      const { life, ma } = store.get();
      // Still this story, and still where it opened: the reader has not gone elsewhere.
      if (life?.pbdb === story.clade.pbdb && ma === origin.ma) play(story, origin.ma);
    }, BEGIN_PAUSE_MS);
  }

  let followed: number | null = null;
  /** While it plays, turn the globe to each moment's place as its step comes. */
  function follow(story: Story, step: number): void {
    if (step === followed) return;
    followed = step;
    if (!context.deepTime.playing()) return;
    const where = story.chapters.findLast(
      (chapter) => chapter.ma === step && chapter.where !== null,
    )?.where;
    if (where !== null && where !== undefined) context.globe.flyTo(where);
  }

  function tell(group: LifeGroup, pbdb: number, focus: number | null): void {
    store.set((state) => ({ ...state, life: { group, pbdb, focus } }));
    void load(group).then((data) => {
      const story = storyOf(data, pbdb, focus);
      if (story === null) {
        context.notify('That lineage has no placed finds to tell a story from.');
        store.set((state) => ({ ...state, life: null }));
        return;
      }
      begin(story);
    });
  }

  const panel = createLifePanel({
    goTo(ma, where) {
      context.deepTime.enter(ma);
      if (where !== null) context.globe.flyTo(where);
    },
    open(pbdb, focus) {
      const { life } = store.get();
      if (life !== null) tell(life.group, pbdb, focus);
    },
    play() {
      const story = storyFrom(store.get());
      if (story === null || typeof story === 'string') return;
      const [oldest] = story.steps;
      const youngest = story.steps.at(-1);
      if (oldest === undefined || youngest === undefined) return;
      const current = store.get().ma;
      // From where the reader is, if inside the story, not at its end and not playing already.
      const inside = current !== null && current <= oldest.ma && current > youngest.ma;
      play(story, inside && !context.deepTime.playing() ? current : oldest.ma);
    },
    find() {
      finder.open();
    },
    close() {
      store.set((state) => ({ ...state, life: null }));
    },
  });

  let picked: Mark | null = null;
  const card = createLifeCard({
    tell(node) {
      const { life } = store.get();
      const data = life === null ? undefined : loaded.get(life.group);
      if (life === null || data === undefined) return;
      picked = null;
      const { pbdb, focus } = storyFor(data, node);
      tell(life.group, pbdb, focus);
    },
    goTo(ma, where) {
      picked = null;
      context.deepTime.enter(ma);
      context.globe.flyTo(where);
      render(store.get());
    },
    close() {
      picked = null;
      render(store.get());
    },
  });

  const finder = createLifeFinder(
    () => {
      wantPictures();
      return Promise.all(LIFE_GROUPS.map((group) => load(group)));
    },
    (found, data) => {
      const { pbdb, focus } = storyFor(data, found.node);
      tell(found.group, pbdb, focus);
    },
    () => pictures,
  );

  function render(state: ViewState): void {
    const story = storyFrom(state);
    if (story === null || typeof story === 'string' || state.ma === null) picked = null;
    if (story === 'loading' || story === 'failed') {
      card.show(null, null, null);
      panel.say(story === 'loading' ? 'Loading the story…' : 'The story could not load.');
      marks.update(null);
      return;
    }
    panel.render(story, state.ma, context.deepTime.playing());
    if (story === null || state.ma === null) {
      marks.update(null);
      card.show(null, null, null);
      return;
    }
    const step = stepAt(story, state.ma);
    // A card is of a site in a step: it closes when time moves on to another.
    if (picked !== null && picked.site.ma !== step && picked.kind !== 'ended') picked = null;
    follow(story, step);
    const shown = marksAt(story, state.ma);
    if (picked !== null) {
      const { node, site } = picked;
      picked = shown.find((mark) => mark.node === node && mark.site === site) ?? null;
    }
    card.show(picked, story.data, pictures);
    marks.update({
      key: [
        story.clade.pbdb,
        story.focus?.pbdb ?? '',
        step,
        pictures !== null,
        picked === null
          ? ''
          : `${String(picked.node.pbdb)}@${String(picked.site.latitude)},${String(picked.site.longitude)}`,
      ].join(':'),
      marks: shown,
      silhouette: (name) => pictures?.names[name]?.silhouette ?? null,
      picked,
      pick(mark) {
        picked = mark;
        render(store.get());
      },
    });
  }

  return {
    watches: WATCHES,
    elements: [panel.root, card.root],
    render,
    button: finder.button,
    dialog: finder.dialog,
  };
}
