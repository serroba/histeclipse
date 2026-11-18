/**
 * What the wave view draws (#829, #831, #832), chapter by chapter: its source, two black holes
 * orbiting in a sheet of space their wave spirals out through (`sourceSheet.ts`); space, the ring of free masses and
 * the sheets the wave has crossed (`spaceGrid.ts`); or LIGO Livingston, its arms moved by the
 * strain it measured (`detectorRig.ts`). Each chapter says where the camera looks from; only the
 * chapter shown is moved and drawn.
 *
 * Builds and moves objects only: the view (`waveView.ts`) draws them.
 */

import { AmbientLight, DirectionalLight, Scene, Vector3 } from 'three';

import { bearingDirection, createDetectorRig, DETECTOR_SITES } from './detectorRig';
import { createSourceSheet } from './sourceSheet';
import { createSpaceGrid, SHEETS, STACK_DEPTH } from './spaceGrid';
import type { Waveform } from './strain';
import { EXAGGERATION, sheets, strainOfSheets } from './wavePlay';

export const WAVE_CHAPTERS = ['source', 'space', 'detector'] as const;
export type WaveChapter = (typeof WAVE_CHAPTERS)[number];

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

export const AIMS: Readonly<Record<WaveChapter, Aim>> = {
  // Nearly face on to the ring, a little from above and to one side, so the sheets behind show.
  space: {
    target: new Vector3(0, 0, -STACK_DEPTH * 0.15),
    from: new Vector3(0.2, 0.18, 1).normalize(),
  },
  // The source from above its orbit and to one side, far enough back to see the spiral leave.
  source: {
    target: new Vector3(0, 0, 0.4),
    from: new Vector3(0, 0.5, 0.87).normalize(),
    back: 1.9,
  },
  // From above and to the south, north up the screen.
  detector: { target: middleOfArms(), from: new Vector3(0, 0.85, 0.53).normalize() },
};

export interface WaveScene {
  readonly scene: Scene;
  /** Show a chapter, and only it. */
  show(chapter: WaveChapter): void;
  /** Move what the chapter shown has for the wave's time `t`, s from the merger. */
  set(wave: Waveform, t: number): void;
  /** Points as wide on every screen. */
  scalePoints(pixelRatio: number): void;
  dispose(): void;
}

export function createWaveScene(): WaveScene {
  const scene = new Scene();
  const stack = sheets(SHEETS, STACK_DEPTH);
  const grid = createSpaceGrid(stack.depths);
  const rig = createDetectorRig(DETECTOR_SITES.L1);
  const source = createSourceSheet();
  const key = new DirectionalLight(0xffffff, 2.2);
  key.position.set(2, 3, 4);
  scene.add(source.group, grid.group, rig.group, key, new AmbientLight(0x8890a0, 0.8));
  let shown: WaveChapter = 'space';
  function show(chapter: WaveChapter): void {
    shown = chapter;
    source.group.visible = chapter === 'source';
    grid.group.visible = chapter === 'space';
    rig.group.visible = chapter === 'detector';
  }
  show('space');
  return {
    scene,
    show,
    set(wave, t) {
      if (shown === 'source') {
        source.set(wave, t);
        return;
      }
      if (shown === 'space') {
        grid.set(strainOfSheets(wave, t, stack));
        return;
      }
      // The strain Livingston measured is the wave's h₊ as the ring plays it.
      rig.set(wave.at(t).plus * EXAGGERATION, wave.peak * EXAGGERATION);
    },
    scalePoints: (pixelRatio) => {
      grid.scalePoints(pixelRatio);
    },
    dispose() {
      grid.dispose();
      rig.dispose();
      source.dispose();
    },
  };
}
