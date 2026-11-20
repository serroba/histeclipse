/**
 * What the wave view draws (#829, #831, #832, #833), chapter by chapter, in the story's order:
 * its source, two black holes or two neutron stars orbiting in a sheet of space their wave
 * spirals out through (`sourceSheet.ts`); its journey to Earth (`journeyScene.ts`); what it does to space, the ring
 * of free masses and the sheets it has crossed (`spaceGrid.ts`); and LIGO Livingston, its arms
 * moved by the strain it measured (`detectorRig.ts`). Each chapter says where the camera looks
 * from, how long it plays and what a still picture of it shows; only the chapter shown is moved
 * and drawn.
 *
 * Builds and moves objects only: the view (`waveView.ts`) draws them.
 */

import { AmbientLight, DirectionalLight, Scene, type Texture, Vector3 } from 'three';

import type { WaveChapter } from '../../state/slices/display';
import { bearingDirection, createDetectorRig, DETECTOR_SITES } from './detectorRig';
import { JOURNEY_MS, journeyAt, journeyMs, journeyText } from './journey';
import { KILONOVA_MS, kilonovaDays, kilonovaMs, kilonovaText } from './kilonova';
import { createKilonovaScene } from './kilonovaScene';
import { createJourneyScene } from './journeyScene';
import type { Bodies } from './events';
import { createSourceSheet } from './sourceSheet';
import { createSpaceGrid, SHEETS, STACK_DEPTH } from './spaceGrid';
import type { Waveform } from './strain';
import {
  EXAGGERATION,
  loopMs,
  mergerMs,
  momentText,
  sheets,
  strainOfSheets,
  waveTimeAt,
} from './wavePlay';

/** Where a chapter's camera looks, and from which way. */
export interface Aim {
  readonly target: Vector3;
  readonly from: Vector3;
  /** How much farther back than the framing's own the camera stands. */
  readonly back?: number;
}

/** The middle of the L, between the ends of its arms. */
function middleOfArms(): Vector3 {
  const [xEast, xSouth] = bearingDirection(DETECTOR_SITES.L1.x);
  const [yEast, ySouth] = bearingDirection(DETECTOR_SITES.L1.y);
  return new Vector3((xEast + yEast) / 2, 0, (xSouth + ySouth) / 2);
}

/**
 * Over the two detectors, from across the wave's path: so the front is seen sweeping over
 * North America, edge on, a little toward the side it comes from.
 */
function overTheDetectors(heading: Vector3, detectors: Vector3): Vector3 {
  const across = detectors.clone().addScaledVector(heading, -detectors.dot(heading)).normalize();
  return across.multiplyScalar(0.9).addScaledVector(heading, -0.4).normalize();
}

/** Where each chapter's camera looks from: the journey's needs the wave's heading, and where
 * the detectors are. */
export function aimsFor(heading: Vector3, detectors: Vector3): Readonly<Record<WaveChapter, Aim>> {
  return {
    // The source from above its orbit and to one side, far enough back to see the spiral leave.
    source: {
      target: new Vector3(0, 0, 0.4),
      from: new Vector3(0, 0.5, 0.87).normalize(),
      back: 1.9,
    },
    journey: {
      target: new Vector3(0, 0, 0),
      from: overTheDetectors(heading, detectors),
      back: 1.4,
    },
    // Nearly face on to the ring, a little from above and to one side, so the sheets behind show.
    space: {
      target: new Vector3(0, 0, -STACK_DEPTH * 0.15),
      from: new Vector3(0.2, 0.18, 1).normalize(),
    },
    // From above and to the south, north up the screen.
    detector: { target: middleOfArms(), from: new Vector3(0, 0.85, 0.53).normalize() },
    // A little above the orbit's plane, so the blue streams to the poles and the red band show.
    kilonova: {
      target: new Vector3(0, 0, 0),
      from: new Vector3(0.3, 0.35, 0.89).normalize(),
      back: 1.35,
    },
  };
}

/** What a chapter shows at a moment: in words, and the wave's time if it plays the wave. */
interface Shown {
  readonly text: string;
  /** s from the merger; null in the journey and the kilonova, which keep their own time. */
  readonly t: number | null;
}

export interface WaveScene {
  readonly scene: Scene;
  readonly aims: Readonly<Record<WaveChapter, Aim>>;
  /** Show a chapter, and only it. */
  show(chapter: WaveChapter): void;
  /** How long the chapter shown plays, ms, before it starts again (or holds, the journey). */
  lengthMs(wave: Waveform): number;
  /** Where a still picture of the chapter shown is taken, ms: the merger, or the arrival. */
  stillMs(wave: Waveform): number;
  /** Move what the chapter shown has, `ms` into it; `atLivingston` is when the merger's wave
   * reached Livingston, s after 09:50:45 UTC. */
  set(wave: Waveform, ms: number, atLivingston: number): Shown;
  /** Points as wide on every screen. */
  scalePoints(pixelRatio: number): void;
  /** Dress Earth in its map. */
  dressEarth(map: Texture): void;
  dispose(): void;
}

/** The scene for a wave made by `bodies`. */
export function createWaveScene(bodies: Bodies): WaveScene {
  const scene = new Scene();
  const stack = sheets(SHEETS, STACK_DEPTH);
  const grid = createSpaceGrid(stack.depths);
  const rig = createDetectorRig(DETECTOR_SITES.L1);
  const source = createSourceSheet(bodies);
  const journey = createJourneyScene();
  const kilonova = createKilonovaScene();
  const key = new DirectionalLight(0xffffff, 2.2);
  key.position.set(2, 3, 4);
  const groups: Readonly<Record<WaveChapter, { visible: boolean }>> = {
    source: source.group,
    journey: journey.group,
    space: grid.group,
    detector: rig.group,
    kilonova: kilonova.group,
  };
  scene.add(source.group, journey.group, grid.group, rig.group, kilonova.group, key);
  scene.add(new AmbientLight(0x8890a0, 0.8));
  let shown: WaveChapter = 'source';
  function show(chapter: WaveChapter): void {
    shown = chapter;
    for (const [name, group] of Object.entries(groups)) group.visible = name === chapter;
  }
  show('source');
  return {
    scene,
    aims: aimsFor(journey.heading, journey.detectors),
    show,
    lengthMs(wave) {
      if (shown === 'journey') return journeyMs();
      if (shown === 'kilonova') return KILONOVA_MS.glow + KILONOVA_MS.rest;
      return loopMs(wave);
    },
    stillMs(wave) {
      if (shown === 'journey') return JOURNEY_MS.travel + JOURNEY_MS.arrive;
      // A day and a half after: the blue at its brightest, strontium seen.
      if (shown === 'kilonova') return kilonovaMs(1.5);
      return mergerMs(wave);
    },
    set(wave, ms, atLivingston) {
      if (shown === 'kilonova') {
        const days = kilonovaDays(ms);
        kilonova.set(days);
        return { text: kilonovaText(days), t: null };
      }
      if (shown === 'journey') {
        const moment = journeyAt(ms, atLivingston);
        journey.set(wave, moment);
        return { text: journeyText(moment), t: null };
      }
      const t = waveTimeAt(wave, ms);
      if (shown === 'source') source.set(wave, t);
      else if (shown === 'space') grid.set(strainOfSheets(wave, t, stack));
      // The strain Livingston measured is the wave's h₊ as the ring plays it.
      else rig.set(wave.at(t).plus * EXAGGERATION, wave.peak * EXAGGERATION);
      return { text: momentText(wave, t), t };
    },
    scalePoints: (pixelRatio) => {
      grid.scalePoints(pixelRatio);
    },
    dressEarth: (map) => {
      journey.dressEarth(map);
    },
    dispose() {
      grid.dispose();
      rig.dispose();
      source.dispose();
      journey.dispose();
      kilonova.dispose();
    },
  };
}
