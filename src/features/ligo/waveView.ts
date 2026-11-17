/**
 * The wave passing (#829), drawn: the ring and the space it floats in (`spaceGrid.ts`), seen a
 * little from above and to one side so the sheets behind show, the wave coming toward the
 * reader. It plays, holds, starts again, or settles at the merger for readers who ask for less
 * motion; the reader can drag it round and zoom. Loaded the first time the wave is opened.
 */

import {
  AmbientLight,
  type Camera,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { createSpaceGrid, SHEETS, STACK_DEPTH } from './spaceGrid';
import type { Waveform } from './strain';
import { mergerMs, momentText, sheets, strainOfSheets, waveTimeAt } from './wavePlay';

/** What the view asks of a renderer: WebGL's, or a stand-in in the unit tests. */
export interface WaveRenderer {
  readonly domElement: HTMLCanvasElement;
  setPixelRatio(ratio: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  setClearColor(colour: number): void;
  setAnimationLoop(loop: ((now: number) => void) | null): void;
  render(scene: Scene, camera: Camera): void;
  dispose(): void;
  forceContextLoss(): void;
}

export interface WaveViewOptions {
  readonly wave: Waveform;
  /** Whether the reader asked for less motion: then it settles at the merger and holds. */
  readonly stillness: boolean;
  /** How much of the view's foot the stage covers, px: the ring is framed above it. */
  readonly covered?: () => number;
  /** Told where the wave is, in words, whenever that changes. */
  readonly onMoment: (text: string) => void;
  readonly renderer?: () => WaveRenderer;
}

export interface WaveView {
  setPlaying(playing: boolean): void;
  restart(): void;
  dispose(): void;
}

/** Behind it all: near-black, a little blue, as the other stories. */
const NIGHT = 0x02040a;
/** What the camera looks at, just behind the ring, and the way it looks from: nearly face on,
 * a little from above and to one side, so the sheets behind show. */
const TARGET = new Vector3(0, 0, -STACK_DEPTH * 0.15);
const FROM = new Vector3(0.2, 0.18, 1).normalize();
/** How much of the space, in ring radii from its middle, the camera keeps in view. */
const FRAMED = 1.5;
const HALF_FOV = (20 * Math.PI) / 180;

/**
 * How the story frames a view `width` by `height` px whose foot is `covered` px: how far its
 * middle is lifted, px, to the middle of what is left free, and how far back the camera stands
 * for the framed space to fit both that height and the width.
 */
export function framing(
  width: number,
  height: number,
  covered: number,
): { readonly lift: number; readonly distance: number } {
  const hidden = Math.min(height * 0.6, Math.max(0, covered));
  const fits = Math.max(height / (height - hidden), height / width);
  return { lift: hidden / 2, distance: (FRAMED / Math.tan(HALF_FOV)) * fits };
}

/** The reader's hold on the camera: drag round it and zoom, not pan away from it. */
function readerControls(camera: PerspectiveCamera, canvas: HTMLCanvasElement): OrbitControls {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 1.5;
  controls.maxDistance = 30;
  return controls;
}

function webgl(): WaveRenderer {
  return new WebGLRenderer({ antialias: true });
}

/** Draws the wave into `host`, filling it. If WebGL cannot be had, throws: the part says so. */
/** The scene: the stack of sheets, the ring and its grid, lit. */
function space(): {
  readonly scene: Scene;
  readonly stack: ReturnType<typeof sheets>;
  readonly grid: ReturnType<typeof createSpaceGrid>;
} {
  const scene = new Scene();
  const stack = sheets(SHEETS, STACK_DEPTH);
  const grid = createSpaceGrid(stack.depths);
  const key = new DirectionalLight(0xffffff, 2.2);
  key.position.set(2, 3, 4);
  scene.add(grid.group, key, new AmbientLight(0x8890a0, 0.8));
  return { scene, stack, grid };
}

export function mountWaveView(host: HTMLElement, options: WaveViewOptions): WaveView {
  const { wave } = options;
  const renderer = (options.renderer ?? webgl)();
  renderer.setClearColor(NIGHT);
  const { scene, stack, grid } = space();
  const camera = new PerspectiveCamera(40, 1, 0.05, 100);
  const canvas = renderer.domElement;
  canvas.setAttribute('data-testid', 'wave-canvas');
  host.append(canvas);
  const controls = readerControls(camera, canvas);

  let distance = 6;
  let taken = false;
  controls.addEventListener('start', () => {
    taken = true;
  });
  function fit(): void {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, true);
    grid.scalePoints(pixelRatio);
    camera.aspect = width / height;
    const framed = framing(width, height, options.covered?.() ?? 0);
    camera.setViewOffset(width, height, 0, framed.lift, width, height);
    camera.updateProjectionMatrix();
    distance = framed.distance;
    if (!taken) place();
  }
  /** The story's own camera. */
  function place(): void {
    camera.position.copy(FROM).multiplyScalar(distance).add(TARGET);
    controls.target.copy(TARGET);
    controls.update();
  }
  fit();
  place();
  const watcher = new ResizeObserver(fit);
  watcher.observe(host);

  let playing = !options.stillness;
  let ms = options.stillness ? mergerMs(wave) : 0;
  let last: number | null = null;
  let said = '';
  host.dataset['playing'] = String(playing);
  renderer.setAnimationLoop((now) => {
    const dt = last === null ? 0 : Math.min(100, now - last);
    last = now;
    if (playing) ms += dt;
    const t = waveTimeAt(wave, ms);
    grid.set(strainOfSheets(wave, t, stack));
    const text = momentText(wave, t);
    if (text !== said) {
      said = text;
      options.onMoment(text);
    }
    controls.update();
    renderer.render(scene, camera);
    host.dataset['drawn'] = 'true';
  });

  return {
    setPlaying(next) {
      playing = next;
      host.dataset['playing'] = String(next);
    },
    restart() {
      ms = 0;
      taken = false;
      place();
    },
    dispose() {
      renderer.setAnimationLoop(null);
      watcher.disconnect();
      controls.dispose();
      grid.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      for (const name of ['playing', 'drawn']) Reflect.deleteProperty(host.dataset, name);
    },
  };
}
