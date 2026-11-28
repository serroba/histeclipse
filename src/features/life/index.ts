/**
 * An animal's story, as a part of the page (#443): find an animal by the name a reader knows,
 * and its lineage's finds are told as a story on the globe. Deep time opens at its oldest finds
 * with the globe coloured by temperature, and plays to today: dots where its kinds were found
 * as the continents moved, each kind's picture round the globe, and beside it a chart of where,
 * how warm and how many, with the doors between the continents and the moments worth stopping
 * at. A tap on a dot opens its site's card.
 */

import type { GeoPoint } from '../../core/geo';
import type { Globe } from '../../globe/globe';
import type { Watch } from '../../state/redraws';
import { layerTurned, type DeepScale, type LifeStory, type ViewState } from '../../state/viewState';
import type { MountedPart, PartContext } from '../part';
import { createLifeCard, type LifeCard } from './card';
import { withDoors } from './doors';
import { createLifeFiles, type LifeFiles } from './files';
import { createLifeFinder, type LifeFinder } from './finder';
import { marksAt, type Mark } from './marks';
import { lifeMarksLayer, type LifeMarks } from './marksLayer';
import { storyFor } from './names';
import { createLifePanel, type LifePanel, type PanelActions } from './panel';
import { stepAt, storyOf, type Story } from './story';
import { createTelling, type Telling } from './telling';
import './life.css';

/** What the story asks of the rest of the page. */
export interface LifeContext extends PartContext {
  readonly globe: Pick<Globe, 'addLayer' | 'flyTo'>;
  /** Deep time, as its part offers it: go to a moment on a span, play from one, whether it plays. */
  readonly deepTime: {
    readonly enterDeepTime: (ma: number, deepScale?: DeepScale) => void;
    readonly playFrom: (ma: number, deepScale: DeepScale, maPerSecond: number) => void;
    readonly playing: () => boolean;
  };
}

export interface LifePart extends MountedPart {
  readonly button: HTMLElement;
}

const WATCHES: Watch = (state) => [state.life, state.ma];

/** What the part's views share: the page, the files, the telling, and the mark picked. */
interface Hub {
  readonly context: LifeContext;
  readonly files: LifeFiles;
  readonly telling: Telling;
  /** The mark whose card is open. */
  picked: Mark | null;
  /** The story the view asks for now, once its group's file has loaded. */
  readonly story: () => Story | null | 'loading' | 'failed';
  /** Tell a lineage's story from its start. */
  readonly tell: (life: LifeStory) => void;
  /** Go to a moment, the globe turned to a place if one is given. */
  readonly goTo: (ma: number, where: GeoPoint | null) => void;
  /** Show what the view asks for again. */
  readonly again: () => void;
}

function tellingOf({ store, globe, deepTime }: LifeContext): Telling {
  return createTelling({
    enter: (ma) => {
      deepTime.enterDeepTime(ma, 'all');
    },
    play: (ma, maPerSecond) => {
      deepTime.playFrom(ma, 'all', maPerSecond);
    },
    playing: () => deepTime.playing(),
    flyTo: (where) => {
      globe.flyTo(where);
    },
    warmth: () => {
      store.set((state) => layerTurned(state, 'temperature', true));
    },
    now: () => ({ ma: store.get().ma, pbdb: store.get().life?.pbdb ?? null }),
    after: (run, ms) => {
      setTimeout(run, ms);
    },
  });
}

/** Keeps the story a view asks for until it asks for another, or its doors arrive. */
function storyKeeper(files: LifeFiles): (life: LifeStory) => Story | null | 'loading' | 'failed' {
  let kept: { readonly key: string; readonly story: Story | null } | null = null;
  return (life) => {
    const data = files.group(life.group);
    if (typeof data === 'string') return data;
    const doors = files.doors();
    const key = [life.group, life.pbdb, life.focus, doors !== null].join(':');
    if (kept?.key !== key) {
      const story = storyOf(data, life.pbdb, life.focus);
      kept = { key, story: story === null || doors === null ? story : withDoors(story, doors) };
    }
    return kept.story;
  };
}

function hubOf(context: LifeContext, again: () => void): Hub {
  const { store, globe, deepTime } = context;
  const files = createLifeFiles({ ...context, arrived: again });
  const keeper = storyKeeper(files);
  const telling = tellingOf(context);
  const hub: Hub = {
    context,
    files,
    telling,
    picked: null,
    again,
    story() {
      const { life } = store.get();
      return life === null ? null : keeper(life);
    },
    tell(life) {
      hub.picked = null;
      store.set((state) => ({ ...state, life }));
      void files.load(life.group).then((data) => {
        const story = storyOf(data, life.pbdb, life.focus);
        if (story !== null) {
          telling.begin(story);
          return;
        }
        context.notify('That lineage has no placed finds to tell a story from.');
        store.set((state) => ({ ...state, life: null }));
      });
    },
    goTo(ma, where) {
      hub.picked = null;
      deepTime.enterDeepTime(ma, 'all');
      if (where !== null) globe.flyTo(where);
      again();
    },
  };
  return hub;
}

function panelOf(hub: Hub, find: () => void): LifePanel {
  const { store } = hub.context;
  const actions: PanelActions = {
    goTo: hub.goTo,
    open(pbdb, focus) {
      const { life } = store.get();
      if (life !== null) hub.tell({ group: life.group, pbdb, focus });
    },
    play() {
      const story = hub.story();
      if (story !== null && typeof story !== 'string') hub.telling.play(story);
    },
    find,
    close() {
      store.set((state) => ({ ...state, life: null }));
    },
  };
  return createLifePanel(actions, hub.context.why('life', 'An animal’s story'));
}

function cardOf(hub: Hub): LifeCard {
  return createLifeCard({
    tell(node) {
      const { life } = hub.context.store.get();
      const data = life === null ? 'loading' : hub.files.group(life.group);
      if (life !== null && typeof data !== 'string') {
        hub.tell({ group: life.group, ...storyFor(data, node) });
      }
    },
    goTo: hub.goTo,
    close() {
      hub.picked = null;
      hub.again();
    },
  });
}

function finderOf(hub: Hub): LifeFinder {
  return createLifeFinder(
    hub.files.all,
    (found, data) => {
      hub.tell({ group: found.group, ...storyFor(data, found.node) });
    },
    hub.files.pictures,
  );
}

/** A story's marks at a moment, and which of them is picked: its card stays while it is shown. */
function marksOf(hub: Hub, story: Story, ma: number): LifeMarks {
  const step = stepAt(story, ma);
  hub.telling.follow(story, step);
  const shown = marksAt(story, ma);
  const before = hub.picked;
  hub.picked =
    before === null
      ? null
      : (shown.find((mark) => mark.node === before.node && mark.site === before.site) ?? null);
  const pictures = hub.files.pictures();
  return {
    key: [story.clade.pbdb, story.focus?.pbdb, step, pictures !== null, hub.picked?.title].join(
      ':',
    ),
    marks: shown,
    silhouette: (name) => pictures?.names[name]?.silhouette ?? null,
    picked: hub.picked,
    pick(mark) {
      hub.picked = mark;
      hub.again();
    },
  };
}

export function mountLife(context: LifeContext): LifePart {
  const marks = context.globe.addLayer(lifeMarksLayer);
  const hub = hubOf(context, () => {
    render(context.store.get());
  });
  const finder = finderOf(hub);
  const panel = panelOf(hub, finder.open);
  const card = cardOf(hub);

  function render(state: ViewState): void {
    const story = hub.story();
    const pictures = hub.files.pictures();
    const doors = hub.files.doors();
    if (pictures !== null) panel.pictures(pictures);
    if (doors !== null) panel.doors(doors);
    if (typeof story === 'string') {
      panel.say(story === 'loading' ? 'Loading the story…' : 'The story could not load.');
    } else {
      panel.render(story, state.ma, context.deepTime.playing());
    }
    if (story === null || typeof story === 'string' || state.ma === null) {
      hub.picked = null;
      card.show(null, null, null);
      marks.update(null);
      return;
    }
    const shown = marksOf(hub, story, state.ma);
    card.show(shown.picked, story.data, pictures);
    marks.update(shown);
  }

  return {
    watches: WATCHES,
    elements: [panel.root, card.root, finder.dialog],
    render,
    button: finder.button,
  };
}
