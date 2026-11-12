/**
 * The shower's story as a part of the page (#269, #317): a cosmic-ray shower played over the
 * meridian in view, its stage with captions, steps and controls, and its chapters in 3D over
 * the globe, each scene's code loaded the first time one of its steps shows.
 */

import { onLand, type ElevationGrid } from '../../data/landSea';
import { loadShelf } from '../../data/shelf';
import type { Globe } from '../../globe/scene';
import type { ShowerState } from '../../globe/showerAnimation';
import {
  captionOf,
  landing,
  SHOWER_STORY,
  SUN_STORY,
  type ShowerStep,
} from '../../globe/showerSteps';
import type { GeoPoint } from '../../state/viewState';
import type { AirShower } from '../../story/airShower';
import type { LeafScene } from '../../story/leafScene';
import type { SunCore } from '../../story/sunCore';
import { element } from '../../ui/dom';
import { loadElevationGrid } from '../../ui/elevationImage';
import { createShowerStage } from '../../ui/showerStage';
import { errorMessage } from '../../util/errors';
import type { PartContext } from '../part';
import './shower.css';

/** What the shower asks of the rest of the page. */
export interface ShowerContext extends PartContext {
  readonly globe: Pick<Globe, 'controlShower' | 'flyTo' | 'zoomTo' | 'playShower'>;
  /** The Layers panel steps aside for the story. */
  closeLayers(): void;
}

export interface ShowerPart {
  /** Where the 3D chapters are drawn, over the globe. */
  readonly container: HTMLElement;
  /** The stage: caption, steps and controls. */
  readonly stage: HTMLElement;
  /** Play the shower under a field's dipole, from the Sun's part of the story or the rays'. */
  readonly watch: (dipole: number, fromSun: boolean) => void;
}

export function mountShower(context: ShowerContext): ShowerPart {
  const { base, fetchJson, store, globe } = context;
  // The stage the shower plays on: its caption, its steps, and controls; the panels step aside.
  const showerStage = createShowerStage((command) => {
    globe.controlShower(command);
    if (command === 'stop') {
      showerStage.close();
      closeStory3d();
    }
  });

  // The story's chapters in 3D (#317), over the globe: the Sun's in one scene, the air's in
  // another, the plant's in a third, each loaded the first time one of its steps shows, one at a time; a scene's WebGL
  // context is let go when the story leaves it or closes. Should one fail to load, the stage
  // draws the steps flat, as before.
  const SCENE_OF: Readonly<Record<ShowerStep, 'sun' | 'air' | 'leaf'>> = {
    fusion: 'sun',
    escape: 'sun',
    journey: 'sun',
    rays: 'air',
    shower: 'air',
    capture: 'air',
    dioxide: 'leaf',
    fall: 'leaf',
    plant: 'leaf',
  };
  const STEPS_IN_3D: ReadonlySet<ShowerStep> = new Set(Object.keys(SCENE_OF) as ShowerStep[]);
  const storyContainer = element('div', {
    class: 'story-3d',
    'data-testid': 'story-3d',
    hidden: '',
  });
  type Story3d =
    | { readonly kind: 'sun'; readonly scene: SunCore }
    | { readonly kind: 'air'; readonly scene: AirShower }
    | { readonly kind: 'leaf'; readonly scene: LeafScene };
  let story3d: Story3d | null = null;
  let story3dLoading: 'sun' | 'air' | 'leaf' | null = null;
  let story3dFailed = false;
  /** The step the 3D scene last showed, to start a chapter afresh on coming to it. */
  let story3dStep: ShowerStep | null = null;
  let story3dLatest: {
    readonly state: ShowerState;
    readonly reduced: boolean;
    readonly caption: string;
  } | null = null;
  /** The shower the scenes draw: where, under what field, over land or sea, from the Sun. */
  let story3dShower: {
    readonly place: GeoPoint;
    readonly dipole: number;
    readonly water: boolean;
    readonly fromSun: boolean;
  } | null = null;
  showerStage.setDrawnIn3d(STEPS_IN_3D);

  /** Load a scene's code and make it, if the story still wants it once it has loaded. */
  function loadStory3d(kind: 'sun' | 'air' | 'leaf'): void {
    story3dLoading = kind;
    const earthTextureUrl = `${base}textures/earth-blue-marble-2048.jpg`;
    const wanted = (): boolean =>
      story3dLoading === kind &&
      showerStage.isOpen &&
      story3dLatest !== null &&
      SCENE_OF[story3dLatest.state.step] === kind;
    const made: Promise<Story3d | null> =
      kind === 'sun'
        ? import('../../story/sunCore').then(({ createSunCore }) =>
            wanted() ? { kind, scene: createSunCore(storyContainer, { earthTextureUrl }) } : null,
          )
        : kind === 'air'
          ? import('../../story/airShower').then(({ createAirShower }) => {
              if (!wanted()) return null;
              if (story3dShower === null) throw new Error('no shower to draw yet');
              const { place, dipole, water } = story3dShower;
              return {
                kind,
                scene: createAirShower(storyContainer, { earthTextureUrl, place, dipole, water }),
              };
            })
          : import('../../story/leafScene').then(({ createLeafScene }) => {
              if (!wanted()) return null;
              if (story3dShower === null) throw new Error('no shower to draw yet');
              const { water, fromSun } = story3dShower;
              return { kind, scene: createLeafScene(storyContainer, { water, fromSun }) };
            });
    made
      .then((scene) => {
        if (story3dLoading === kind) story3dLoading = null;
        story3d = scene ?? story3d;
        if (story3dLatest !== null) {
          const latest = story3dLatest;
          showStory3d(latest.state, latest.reduced, latest.caption);
        }
      })
      .catch((error: unknown) => {
        story3dLoading = null;
        story3dFailed = true;
        storyContainer.hidden = true;
        showerStage.setDrawnIn3d(new Set());
        if (story3dLatest !== null) showerStage.render(story3dLatest.state, story3dLatest.caption);
        context.notify(
          `Could not draw the story in 3D, so it is drawn flat: ${errorMessage(error)}`,
        );
      });
  }

  function showStory3d(state: ShowerState, reduced: boolean, caption: string): void {
    story3dLatest = { state, reduced, caption };
    const before = story3dStep;
    story3dStep = state.step;
    const kind = SCENE_OF[state.step];
    if (story3dFailed) {
      storyContainer.hidden = true;
      story3d?.scene.setPlaying(false);
      return;
    }
    storyContainer.hidden = false;
    if (story3d?.kind !== kind) {
      // The other scene, if one is up, gives way; this one starts afresh once it has loaded.
      story3d?.scene.dispose();
      story3d = null;
      story3dStep = null;
      if (story3dLoading !== kind) loadStory3d(kind);
      return;
    }
    if (before !== state.step) {
      const { step } = state;
      if (story3d.kind === 'sun') {
        story3d.scene.setChapter(step === 'escape' || step === 'journey' ? step : 'fusion');
      } else if (story3d.kind === 'air') {
        story3d.scene.setChapter(step === 'shower' || step === 'capture' ? step : 'rays');
      } else {
        story3d.scene.setChapter(step === 'fall' || step === 'plant' ? step : 'dioxide');
      }
      if (reduced) story3d.scene.settle();
      else story3d.scene.restart();
    }
    if (!reduced) story3d.scene.setPlaying(state.playing);
  }

  function closeStory3d(): void {
    story3d?.scene.dispose();
    story3d = null;
    story3dLoading = null;
    story3dStep = null;
    story3dLatest = null;
    storyContainer.hidden = true;
  }

  // Today's land and sea, to say whether the carbon lands on land or water; asked for once.
  let elevations: Promise<ElevationGrid | null> | null = null;
  function landAndSea(): Promise<ElevationGrid | null> {
    elevations ??= loadShelf(`${base}data/shelf/index.json`, fetchJson)
      .then((index) => loadElevationGrid(`${base}data/shelf/${index.file}`, index))
      .catch((error: unknown) => {
        elevations = null;
        context.notify(`Could not load today's coasts: ${errorMessage(error)}`);
        return null;
      });
    return elevations;
  }

  /**
   * Play a cosmic-ray shower over the meridian in view: seen from the side as the rays come in,
   * then close up as one bursts, under the field picked. It ends on a plant where it lands on
   * land, and on algae where it lands on water.
   */
  function watchShower(dipole: number, fromSun: boolean): void {
    const story = fromSun ? SUN_STORY : SHOWER_STORY;
    /** Turn to a body: the Sun for its steps, Earth for the shower's. */
    const focusOn = (body: 'sun' | 'earth'): void => {
      if (store.get().focus !== body)
        store.set((state) => ({ ...state, focus: body, view: 'free' }));
    };
    focusOn('earth');
    context.closeLayers();
    // Over the place picked, if it is far enough from the equator for rays to get through
    // today; else at 60° along the meridian in view.
    const picked = store.get().location;
    const place =
      picked !== null && Math.abs(picked.latitude) >= 35
        ? { latitude: picked.latitude, longitude: picked.longitude }
        : { latitude: 60, longitude: store.get().camera.target.longitude };
    const { longitude } = place;
    /** Where the camera stands for each step, whichever way the reader came to it. */
    const frame = (step: ShowerStep): void => {
      if (step === 'fusion' || step === 'escape' || step === 'journey') {
        // The Sun, close up, while its part of the story is drawn on the stage.
        focusOn('sun');
        return;
      }
      focusOn('earth');
      if (step === 'rays') {
        // From the side, so the rays are seen coming in from space.
        globe.flyTo({ latitude: 20, longitude: longitude - 90 });
        globe.zoomTo(4.4);
      } else if (step === 'fall' || step === 'plant') {
        // A little toward the equator, to follow it falling to where it lands.
        globe.flyTo({ latitude: place.latitude - 1.5, longitude });
        globe.zoomTo(1.35);
      } else {
        // In close over the strike, for the shower and what it makes.
        globe.flyTo(place);
        globe.zoomTo(1.35);
      }
    };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    frame(fromSun ? 'fusion' : 'rays');
    showerStage.open(reduced, story);
    // Once the globe has turned to it, and today's coasts have said where it lands.
    const turned = new Promise((done) => window.setTimeout(done, 1000));
    void Promise.all([landAndSea(), turned]).then(([grid]) => {
      const water = grid !== null && !onLand(grid, landing(place));
      story3dShower = { place, dipole, water, fromSun };
      let framed: ShowerStep | null = null;
      globe.playShower({
        place,
        dipole,
        water,
        fromSun,
        onState(state) {
          if (state.step !== framed) {
            framed = state.step;
            frame(state.step);
          }
          const caption = captionOf(state.step, dipole, water, fromSun);
          showerStage.render(state, caption);
          showStory3d(state, reduced, caption);
        },
      });
      // Under reduced motion, each step waits for the reader, its picture complete.
      if (reduced) globe.controlShower('settle');
    });
  }

  return {
    container: storyContainer,
    stage: showerStage.root,
    watch: watchShower,
  };
}
