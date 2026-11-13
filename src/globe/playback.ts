/**
 * What plays on Earth (#314, #379): impacts, several at once as deep time runs, and a cosmic-ray
 * shower making carbon-14, each counted as it plays out for whoever needs to know one did.
 */

import type { Material, Object3D } from 'three';

import { createImpactAnimation, type ImpactAnimation, type ImpactSpec } from './impactAnimation';
import {
  createShowerAnimation,
  type ShowerAnimation,
  type ShowerCommand,
  type ShowerSpec,
} from './showerAnimation';
import { rayLabels } from './showerSteps';
import type { StagePart } from '../stage/stage';

/** Impacts that play at once, at most; deep time running fast can pass several in a frame. */
const MAX_IMPACTS = 8;

export interface PlaybackWorld {
  /** What the impacts and the shower are drawn on, turning with it. */
  readonly earth: Object3D;
  /** The place's pin, which rests while a shower plays. */
  readonly pin: Material;
  readonly dataset: DOMStringMap;
  /** The drawing's size, pixels, for the shower's lines. */
  resolution(): { readonly x: number; readonly y: number };
  invalidate(): void;
}

export class Playback implements StagePart {
  readonly #world: PlaybackWorld;
  // The impacts playing, oldest first, and how many have played out.
  readonly #impacts = new Set<ImpactAnimation>();
  #impactsPlayed = 0;
  #shower: ShowerAnimation | null = null;
  #showersPlayed = 0;

  constructor(world: PlaybackWorld) {
    this.#world = world;
  }

  /** Move what plays on to `now`; true if it needs drawing. */
  step(now: number): boolean {
    const { dataset } = this.#world;
    let changed = false;
    for (const impact of this.#impacts) {
      changed = true;
      if (impact.update(now)) continue;
      impact.dispose();
      this.#impacts.delete(impact);
      // How many have played out, for whoever needs to know one did, however briefly it showed.
      this.#impactsPlayed += 1;
      dataset['impactsPlayed'] = String(this.#impactsPlayed);
      dataset['impactPlaying'] = String(this.#impacts.size > 0);
    }
    if (this.#shower !== null) {
      const size = this.#world.resolution();
      this.#shower.setResolution(size.x, size.y);
      // Only while it plays, or just after a control: paused or held, it draws nothing new.
      if (this.#shower.update(now)) changed = true;
    }
    return changed;
  }

  /** Play an impact at its place: the approach, the flash, the ring, the crater. */
  playImpact(spec: ImpactSpec): void {
    // Beyond a handful at once, the oldest makes way.
    const [oldest] = this.#impacts;
    if (oldest !== undefined && this.#impacts.size >= MAX_IMPACTS) {
      oldest.dispose();
      this.#impacts.delete(oldest);
    }
    const impact = createImpactAnimation(spec);
    this.#impacts.add(impact);
    this.#world.earth.add(impact.group);
    this.#world.dataset['impactPlaying'] = 'true';
    this.#world.invalidate();
  }

  /** Play a cosmic-ray shower, reporting its state through `onState`. */
  playShower(spec: ShowerSpec): void {
    const { dataset } = this.#world;
    this.#shower?.dispose();
    // Every step it has shown, in order: a slow frame can pass a step's start, never a step.
    const shown: string[] = [];
    let counted = false;
    this.#shower = createShowerAnimation({
      ...spec,
      onState: (state) => {
        dataset['showerStep'] = state.step;
        dataset['showerPlaying'] = String(state.playing);
        if (shown.at(-1) !== state.step) shown.push(state.step);
        dataset['showerSteps'] = shown.join(' ');
        // How many have played to their end, for whoever needs to know one did.
        if (state.ended && !counted) {
          counted = true;
          this.#showersPlayed += 1;
          dataset['showersPlayed'] = String(this.#showersPlayed);
        }
        spec.onState(state);
      },
    });
    this.#world.earth.add(this.#shower.group);
    // The place's pin, a big ball close up, would hide the plant: it rests while the shower
    // plays. Its material only, so the place still counts for the attached viewpoints.
    this.#world.pin.visible = false;
    dataset['pinShown'] = 'false';
    // What the rays' labels say, for whoever needs to read them.
    const words = rayLabels(spec.dipole);
    dataset['showerLabels'] = `${words.polar} | ${words.equator}`;
    dataset['showerGround'] = spec.water ? 'water' : 'land';
    this.#world.invalidate();
  }

  /** Play, pause, step through or replay the shower, or stop it and take it away. */
  controlShower(command: ShowerCommand | 'stop'): void {
    const { dataset } = this.#world;
    if (this.#shower === null) return;
    if (command !== 'stop') {
      this.#shower.command(command);
      // Said at once, not at the next frame, which a busy device may be slow to draw.
      if (command === 'pause' || command === 'settle') dataset['showerPlaying'] = 'false';
      if (command === 'play' || command === 'replay') dataset['showerPlaying'] = 'true';
      this.#world.invalidate();
      return;
    }
    this.#shower.dispose();
    this.#shower = null;
    // The place's pin comes back once the shower is taken away.
    this.#world.pin.visible = true;
    dataset['pinShown'] = 'true';
    dataset['showerStep'] = 'done';
    this.#world.invalidate();
  }

  dispose(): void {
    this.#shower?.dispose();
    for (const impact of this.#impacts) impact.dispose();
  }
}
