/**
 * The wave passing (#829), drawn: the ring and the space it floats in (`spaceGrid.ts`), seen a
 * little from above and to one side so the sheets behind show, the wave coming toward the
 * reader. It plays, holds, starts again, or settles at the merger for readers who ask for less
 * motion; the reader can drag it round and zoom. Loaded the first time the wave is opened.
 */

import { type Camera, PerspectiveCamera, type Scene, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import type { Waveform } from './strain';
import { mergerMs, momentText, waveTimeAt } from './wavePlay';
import { AIMS, createWaveScene, type WaveChapter, type WaveScene } from './waveScene';

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
  /** Told the wave's time, s from the merger, every frame drawn. */
  readonly onTime?: (t: number) => void;
  readonly renderer?: () => WaveRenderer;
}

export interface WaveView {
  /** Show space and the ring, or the detector; the camera goes back to the story's. */
  setChapter(chapter: WaveChapter): void;
  setPlaying(playing: boolean): void;
  restart(): void;
  dispose(): void;
}

/** Behind it all: near-black, a little blue, as the other stories. */
const NIGHT = 0x02040a;
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

/**
 * The camera: framed above the stage as the view resizes, at the story's place for the chapter
 * until the reader takes it, and back there when aimed again (`null`: the same chapter).
 */
function storyCamera(
  host: HTMLElement,
  renderer: WaveRenderer,
  drawn: Pick<WaveScene, 'scalePoints'>,
  covered: (() => number) | undefined,
): {
  readonly camera: PerspectiveCamera;
  readonly controls: OrbitControls;
  aim(chapter: WaveChapter | null): void;
  dispose(): void;
} {
  const camera = new PerspectiveCamera(40, 1, 0.05, 100);
  const controls = readerControls(camera, renderer.domElement);
  let chapter: WaveChapter = 'space';
  let distance = 6;
  let taken = false;
  controls.addEventListener('start', () => {
    taken = true;
  });
  function place(): void {
    const { from, target, back = 1 } = AIMS[chapter];
    camera.position
      .copy(from)
      .multiplyScalar(distance * back)
      .add(target);
    controls.target.copy(target);
    controls.update();
  }
  function fit(): void {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, true);
    drawn.scalePoints(pixelRatio);
    camera.aspect = width / height;
    const framed = framing(width, height, covered?.() ?? 0);
    camera.setViewOffset(width, height, 0, framed.lift, width, height);
    camera.updateProjectionMatrix();
    distance = framed.distance;
    if (!taken) place();
  }
  fit();
  const watcher = new ResizeObserver(fit);
  watcher.observe(host);
  return {
    camera,
    controls,
    aim(next) {
      chapter = next ?? chapter;
      taken = false;
      place();
    },
    dispose() {
      watcher.disconnect();
      controls.dispose();
    },
  };
}

/** Draws the wave into `host`, filling it. If WebGL cannot be had, throws: the part says so. */
export function mountWaveView(host: HTMLElement, options: WaveViewOptions): WaveView {
  const { wave } = options;
  const renderer = (options.renderer ?? webgl)();
  renderer.setClearColor(NIGHT);
  const drawn = createWaveScene();
  const canvas = renderer.domElement;
  canvas.setAttribute('data-testid', 'wave-canvas');
  host.append(canvas);
  const view = storyCamera(host, renderer, drawn, options.covered);

  let playing = !options.stillness;
  let ms = options.stillness ? mergerMs(wave) : 0;
  let last: number | null = null;
  let said = '';
  host.dataset['playing'] = String(playing);
  host.dataset['chapter'] = 'space';
  renderer.setAnimationLoop((now) => {
    const dt = last === null ? 0 : Math.min(100, now - last);
    last = now;
    if (playing) ms += dt;
    const t = waveTimeAt(wave, ms);
    drawn.set(wave, t);
    options.onTime?.(t);
    const text = momentText(wave, t);
    if (text !== said) {
      said = text;
      options.onMoment(text);
    }
    view.controls.update();
    renderer.render(drawn.scene, view.camera);
    host.dataset['drawn'] = 'true';
  });

  return {
    setChapter(next) {
      drawn.show(next);
      host.dataset['chapter'] = next;
      view.aim(next);
    },
    setPlaying(next) {
      playing = next;
      host.dataset['playing'] = String(next);
    },
    restart() {
      ms = 0;
      view.aim(null);
    },
    dispose() {
      renderer.setAnimationLoop(null);
      view.dispose();
      drawn.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      for (const name of ['playing', 'drawn', 'chapter'])
        Reflect.deleteProperty(host.dataset, name);
    },
  };
}
