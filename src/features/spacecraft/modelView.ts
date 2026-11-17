/**
 * A craft's 3D model in its card (#797): a small WebGL view of its own, turning slowly until the
 * reader takes it, to drag round and zoom. Lit by the Sun from where it is in the model's own
 * convention (Webb: below, behind the sunshield), with a light from the viewer's side so the
 * parts the Sun never reaches can still be seen. Fetched with the card that shows it, not before.
 */

import {
  AmbientLight,
  DirectionalLight,
  Mesh,
  PerspectiveCamera,
  Scene,
  Sphere,
  Box3,
  Vector3,
  WebGLRenderer,
  type Camera,
  type Object3D,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** What the view asks of a renderer: WebGL's, or a stand-in in the unit tests. */
export interface ModelRenderer {
  readonly domElement: HTMLCanvasElement;
  setPixelRatio(ratio: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  setAnimationLoop(loop: (() => void) | null): void;
  render(scene: Scene, camera: Camera): void;
  dispose(): void;
  forceContextLoss(): void;
}

export interface ModelViewOptions {
  /** Where the Sun is from the model, in its own axes. */
  readonly sun: Vector3;
  /** Whether the reader asked for less motion: then it does not turn by itself. */
  readonly stillness?: boolean;
  readonly renderer?: () => ModelRenderer;
}

function webgl(): ModelRenderer {
  return new WebGLRenderer({ antialias: true, alpha: true });
}

/** Every geometry and material under `root`, given back. */
function release(root: Object3D): void {
  root.traverse((part) => {
    if (!(part instanceof Mesh)) return;
    const mesh = part as Mesh;
    mesh.geometry.dispose();
    for (const material of [mesh.material].flat()) material.dispose();
  });
}

/** The camera's first place: in front, to one side and above, the whole model in view. */
function frame(model: Object3D, camera: PerspectiveCamera): Sphere {
  const bounds = new Box3().setFromObject(model).getBoundingSphere(new Sphere());
  // A little inside the sphere's own fit: the model is flat, and fills the box better so.
  const distance = (0.72 * bounds.radius) / Math.sin(((camera.fov / 2) * Math.PI) / 180);
  camera.position
    .copy(bounds.center)
    .add(new Vector3(0.6, 0.4, 1).normalize().multiplyScalar(distance));
  camera.near = distance / 100;
  camera.far = distance * 10;
  camera.updateProjectionMatrix();
  return bounds;
}

/**
 * Draws `model` into `host`, filling its width; gives back the way to stop and let go of it all.
 * If the browser cannot draw WebGL, says so in `host` instead.
 */
export function mountModelView(
  host: HTMLElement,
  model: Object3D,
  options: ModelViewOptions,
): () => void {
  let renderer: ModelRenderer;
  try {
    renderer = (options.renderer ?? webgl)();
  } catch {
    release(model);
    host.textContent = 'This browser could not draw the model.';
    return () => undefined;
  }
  const scene = new Scene();
  scene.add(model);
  const camera = new PerspectiveCamera(35, 1, 0.1, 1000);
  const bounds = frame(model, camera);
  const sun = new DirectionalLight(0xfff4e0, 2.6);
  sun.position
    .copy(options.sun)
    .normalize()
    .multiplyScalar(bounds.radius * 3);
  // From the viewer's side, following the camera round, so the shaded side reads.
  const fill = new DirectionalLight(0xdde4ff, 1.8);
  scene.add(sun, fill, new AmbientLight(0x8890a0, 0.6));

  const canvas = renderer.domElement;
  canvas.setAttribute('data-testid', 'craft-model');
  host.append(canvas);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(bounds.center);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = bounds.radius * 0.6;
  controls.maxDistance = bounds.radius * 6;
  controls.autoRotate = options.stillness !== true;
  controls.autoRotateSpeed = 0.8;
  controls.addEventListener('start', () => {
    controls.autoRotate = false;
  });

  function fit(): void {
    const width = Math.max(160, host.clientWidth);
    const height = Math.round(width * 0.62);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, true);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  fit();
  const watcher = new ResizeObserver(fit);
  watcher.observe(host);

  let frames = 0;
  renderer.setAnimationLoop(() => {
    controls.update();
    fill.position.copy(camera.position);
    renderer.render(scene, camera);
    frames += 1;
    // Once, so a test can tell it was drawn.
    if (frames === 1) host.setAttribute('data-drawn', 'true');
  });

  return () => {
    renderer.setAnimationLoop(null);
    watcher.disconnect();
    controls.dispose();
    release(model);
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  };
}
