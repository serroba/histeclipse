/**
 * What every 3D story scene shares (#338): the renderer and its labels, the camera and the
 * reader's controls over it, the loop that plays a chapter, and the play, pause, restart, settle
 * and dispose every scene answers to. A scene supplies only what it draws: for each chapter,
 * where things are at a moment, where the story's camera is, and when the chapter is complete.
 *
 * Idle chapters sleep. Dragging takes the camera; restarting returns it to the story.
 *
 * Three.js glue, loaded with the scenes and covered by the Playwright suite.
 */

import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  type Object3D,
  MeshStandardMaterial,
  PerspectiveCamera,
  type Scene,
  Sprite,
  SpriteMaterial,
  type Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial, type LineMaterialParameters } from 'three/addons/lines/LineMaterial.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

import { Stage } from '../stage/stage';
import { css, PALETTE } from './palette';
import './storyScene.css';

/** What the app asks of a story scene, whichever it is. */
export interface StoryScene<Chapter extends string> {
  /** Turn to a chapter; `restart` or `settle` then starts it. */
  setChapter(chapter: Chapter): void;
  /** Play or hold; held, nothing moves but the reader can still turn and zoom. */
  setPlaying(playing: boolean): void;
  /** Start the chapter again, the camera back with the story. */
  restart(): void;
  /** Show the chapter complete and hold there, for readers who ask for less motion. */
  settle(): void;
  dispose(): void;
}

/** Anything the scene must let go of when it is disposed. */
interface Disposable {
  dispose(): void;
}

/** A line in a legend: plain words, or a name (in its colour) and what it is. */
type LegendEntry =
  string | { readonly name: string; readonly about: string; readonly colour?: number };

/** The tools a scene builds itself with. */
export interface StoryKit<Chapter extends string> {
  readonly container: HTMLElement;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly controls: OrbitControls;
  /** Let go of `item` when the scene is disposed; returns it. */
  own: <T extends Disposable>(item: T) => T;
  /** Draw again on the next frame, though the story is held. */
  invalidate: () => void;
  /** Set a `data-` attribute on the container, for the tests; cleared on dispose. */
  mark: (key: string, value: string) => void;
  /** Show `things` only during `chapter`: objects in the scene, or elements beside it. */
  during: (chapter: Chapter, ...things: readonly (Object3D | HTMLElement)[]) => void;
  /** A soft glow of `colour`, `size` across. */
  glow: (colour: Color | number, size: number, parent: Object3D) => Sprite;
  /** A label in the page, tied to a point in the scene. */
  label: (text: string, parent: Object3D, kind?: string) => CSS2DObject;
  /** A material for lines a few pixels wide, kept the right width as the scene resizes. */
  lineMaterial: (parameters: LineMaterialParameters) => LineMaterial;
  /** A line a few pixels wide through `points`, drawn a part at a time. */
  line: (points: readonly Vector3[], colour: Color, width: number, parent: Object3D) => Line2;
  /** A legend beside the scene, numbered if `ordered`; returns its list and its items. */
  legend: (
    name: string,
    entries: readonly LegendEntry[],
    ordered?: boolean,
  ) => { readonly list: HTMLElement; readonly items: readonly HTMLLIElement[] };
}

/** What a scene draws, given the kit. */
export interface StoryChapters<Chapter extends string> {
  /** When each chapter is complete, ms; `settle` shows it there. */
  readonly ends: Readonly<Record<Chapter, number>>;
  /** Put the story's camera where it is `t` ms into `chapter`; it then looks at the target. */
  camera(chapter: Chapter, t: number): void;
  /** Place everything for `t` ms into `chapter`, when something has moved. */
  place(chapter: Chapter, t: number): void;
  /** Every frame, after the camera, before any drawing: `dt` ms gone, the story playing or not. */
  frame?(t: number, dt: number, playing: boolean): void;
  /** Turning from `previous` to `next`, before it is drawn. */
  turn?(next: Chapter, previous: Chapter): void;
  /** On a restart, besides going back to the chapter's start. */
  restart?(): void;
}

export interface StorySceneOptions<Chapter extends string> {
  readonly first: Chapter;
  /** The camera's near and far planes, in the scene's units. */
  readonly near: number;
  readonly far: number;
  /** Build the scene with the kit, and say how it plays. */
  build(kit: StoryKit<Chapter>): StoryChapters<Chapter>;
}

/** A soft round glow, white, tinted by its material. */
function glowTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (context !== null) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.6)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
  }
  return new CanvasTexture(canvas);
}

/** The material a proton or a neutron inside a nucleus is drawn in. */
export function nucleonMaterial(kind: 'proton' | 'neutron'): MeshStandardMaterial {
  return kind === 'proton'
    ? new MeshStandardMaterial({
        color: PALETTE.nucleonProton,
        roughness: 0.45,
        emissive: PALETTE.nucleonProtonGlow,
      })
    : new MeshStandardMaterial({
        color: PALETTE.nucleonNeutron,
        roughness: 0.45,
        emissive: PALETTE.nucleonNeutronGlow,
      });
}

export function createStoryScene<Chapter extends string>(
  container: HTMLElement,
  options: StorySceneOptions<Chapter>,
): StoryScene<Chapter> {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(PALETTE.night);
  const stage = new Stage(container, {
    renderer,
    camera: new PerspectiveCamera(40, 1, options.near, options.far),
    styleSize: true,
  });
  const labels = new CSS2DRenderer();
  labels.domElement.className = 'story-labels';
  container.append(labels.domElement);

  const { scene } = stage;
  const { camera } = stage;
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const glowMap = glowTexture();
  const owned: Disposable[] = [glowMap];
  const lineMaterials: LineMaterial[] = [];
  const marked = new Set<string>();
  const shownDuring: { chapter: Chapter; thing: Object3D | HTMLElement }[] = [];

  const kit: StoryKit<Chapter> = {
    container,
    scene,
    camera,
    controls,
    own(item) {
      owned.push(item);
      return item;
    },
    invalidate() {
      stage.invalidate();
    },
    mark(key, value) {
      marked.add(key);
      container.dataset[key] = value;
    },
    during(chapter, ...things) {
      for (const thing of things) shownDuring.push({ chapter, thing });
    },
    glow(colour, size, parent) {
      const material = kit.own(
        new SpriteMaterial({
          map: glowMap,
          color: new Color(colour),
          blending: AdditiveBlending,
          depthWrite: false,
          transparent: true,
        }),
      );
      const sprite = new Sprite(material);
      sprite.scale.setScalar(size);
      parent.add(sprite);
      return sprite;
    },
    label(text, parent, kind = '') {
      const element = document.createElement('span');
      element.className = `story-label ${kind}`.trim();
      element.textContent = text;
      const object = new CSS2DObject(element);
      object.center.set(0, 1.2);
      parent.add(object);
      return object;
    },
    lineMaterial(parameters) {
      const material = kit.own(new LineMaterial(parameters));
      lineMaterials.push(material);
      return material;
    },
    line(points, colour, width, parent) {
      const geometry = kit.own(new LineGeometry());
      geometry.setPositions(points.flatMap(({ x, y, z }) => [x, y, z]));
      const material = kit.lineMaterial({
        color: colour.getHex(),
        linewidth: width,
        transparent: true,
        depthWrite: false,
      });
      const drawn = new Line2(geometry, material);
      parent.add(drawn);
      return drawn;
    },
    legend(name, entries, ordered = true) {
      const list = document.createElement(ordered ? 'ol' : 'ul');
      list.className = 'story-chain';
      list.setAttribute('aria-label', name);
      const items = entries.map((entry, index) => {
        const item = document.createElement('li');
        // Numbered by its place, so the one a phone shows alone keeps its number.
        if (ordered) item.value = index + 1;
        if (typeof entry === 'string') {
          item.textContent = entry;
        } else {
          const strong = document.createElement('strong');
          strong.textContent = entry.name;
          if (entry.colour !== undefined) strong.style.color = css(entry.colour);
          item.append(strong, document.createTextNode(`: ${entry.about}`));
        }
        list.append(item);
        return item;
      });
      container.append(list);
      return { list, items };
    },
  };

  const chapters = options.build(kit);
  const hint = document.createElement('p');
  hint.className = 'story-hint';
  hint.textContent = 'Drag to turn, scroll or pinch to zoom. Not to scale.';
  container.append(hint);

  let chapter = options.first;
  let t = 0;
  let playing = true;
  let byStory = true;
  let last = performance.now();
  controls.addEventListener('start', () => {
    byStory = false;
  });
  controls.addEventListener('change', () => {
    stage.invalidate();
  });

  function storyCamera(at: number): void {
    chapters.camera(chapter, at);
    camera.lookAt(controls.target);
  }

  // The story: its time and camera each frame, and its things placed for each drawing.
  stage.add({
    step(now) {
      const dt = Math.min(100, now - last);
      last = now;
      if (playing) t += dt;
      // One owner for the camera at a time. While the story holds it, the controls must not
      // also move it: a story camera beyond their distance limits (an upright screen backs off
      // farther) would be pulled in, put back, and woken again every frame (#667).
      if (byStory) storyCamera(t);
      else controls.update();
      chapters.frame?.(t, dt, playing);
      return playing;
    },
    beforeRender() {
      for (const { chapter: shownIn, thing } of shownDuring) {
        if (thing instanceof HTMLElement) thing.hidden = shownIn !== chapter;
        else thing.visible = shownIn === chapter;
      }
      chapters.place(chapter, t);
      return undefined;
    },
    afterRender() {
      labels.render(scene, camera);
      container.dataset['rendered'] = 'true';
    },
    resize(width, height) {
      labels.setSize(width, height);
      for (const material of lineMaterials) material.resolution.set(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    dispose() {
      controls.dispose();
      for (const item of owned) item.dispose();
    },
  });
  stage.observeResize();
  stage.resize();
  container.dataset['chapter'] = chapter;
  container.dataset['playing'] = 'true';
  stage.start();

  return {
    setChapter(next) {
      chapters.turn?.(next, chapter);
      chapter = next;
      container.dataset['chapter'] = next;
      stage.invalidate();
    },
    setPlaying(next) {
      playing = next;
      last = performance.now();
      container.dataset['playing'] = String(next);
      stage.invalidate();
    },
    restart() {
      t = 0;
      chapters.restart?.();
      byStory = true;
      stage.invalidate();
    },
    settle() {
      t = chapters.ends[chapter];
      storyCamera(t);
      byStory = false;
      playing = false;
      container.dataset['playing'] = 'false';
      stage.invalidate();
    },
    dispose() {
      stage.dispose();
      renderer.forceContextLoss();
      container.replaceChildren();
      for (const key of ['chapter', 'rendered', 'playing', ...marked]) {
        // Only the keys this scene set, so the container's own attributes stay.
        Reflect.deleteProperty(container.dataset, key);
      }
    },
  };
}
