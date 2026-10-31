/**
 * The WebGL globe: Earth lit by the Sun at a given moment, with orbit controls.
 *
 * Rendering-only code. The math it relies on lives in tested modules (`geo.ts`,
 * `astro/sun.ts`); this file is exercised by the Playwright suite in a real browser.
 */

import {
  AdditiveBlending,
  BackSide,
  Mesh,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { CAMERA_DISTANCE_RANGE, type GlobeCamera } from '../state/viewState';
import { cameraFromPosition, cameraPosition, type Vector3Tuple } from './geo';

const NARROW_SIDE_FOV_DEGREES = 40;

export interface Globe {
  /** Direction from Earth's center to the Sun, in the globe frame. */
  setSunDirection(direction: Vector3Tuple): void;
  setCamera(camera: GlobeCamera): void;
  /** Called while the user moves the camera. Returns an unsubscribe function. */
  onCameraChange(listener: (camera: GlobeCamera) => void): () => void;
  readonly canvas: HTMLCanvasElement;
  dispose(): void;
}

const EARTH_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Day side lit by the Sun, a twilight band down to about −6° (civil twilight), a dim blue night
// side (no city lights: they would be anachronistic for most of history), and a faint warm glow
// along the terminator.
const EARTH_FRAGMENT = /* glsl */ `
  uniform sampler2D dayMap;
  uniform vec3 sunDirection;
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vec3 normal = normalize(vNormal);
    float sunAltitude = dot(normal, sunDirection);
    vec3 surface = texture2D(dayMap, vUv).rgb;
    float daylight = smoothstep(-0.105, 0.035, sunAltitude);
    vec3 lit = surface * (0.45 + 0.75 * clamp(sunAltitude, 0.0, 1.0));
    vec3 night = surface * vec3(0.035, 0.05, 0.09) + vec3(0.004, 0.008, 0.02);
    vec3 color = mix(night, lit, daylight);
    float terminator = exp(-pow(sunAltitude / 0.05, 2.0));
    color += vec3(1.0, 0.5, 0.18) * terminator * 0.12;
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

const ATMOSPHERE_VERTEX = /* glsl */ `
  varying vec3 vViewNormal;
  varying vec3 vWorldNormal;
  void main() {
    vViewNormal = normalize(normalMatrix * normal);
    vWorldNormal = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ATMOSPHERE_FRAGMENT = /* glsl */ `
  uniform vec3 sunDirection;
  varying vec3 vViewNormal;
  varying vec3 vWorldNormal;
  void main() {
    float rim = pow(clamp(0.92 + dot(vViewNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 4.0);
    float sunlit = smoothstep(-0.35, 0.35, dot(normalize(vWorldNormal), sunDirection));
    vec3 color = vec3(0.3, 0.55, 1.0) * rim * (0.08 + 0.62 * sunlit);
    gl_FragColor = vec4(color, 1.0);
  }
`;

export async function createGlobe(
  container: HTMLElement,
  options: { readonly camera: GlobeCamera; readonly textureUrl: string },
): Promise<Globe> {
  // preserveDrawingBuffer lets the page (and tests) read the rendered image back.
  // Transparent, so the page's space gradient shows behind the globe.
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.append(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 0.01, 200);

  const texture = await new TextureLoader().loadAsync(options.textureUrl);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const sunDirection = new Vector3(1, 0, 0);
  const earth = new Mesh(
    new SphereGeometry(1, 128, 64),
    new ShaderMaterial({
      uniforms: { dayMap: { value: texture }, sunDirection: { value: sunDirection } },
      vertexShader: EARTH_VERTEX,
      fragmentShader: EARTH_FRAGMENT,
    }),
  );
  const atmosphere = new Mesh(
    new SphereGeometry(1.04, 96, 48),
    new ShaderMaterial({
      uniforms: { sunDirection: { value: sunDirection } },
      vertexShader: ATMOSPHERE_VERTEX,
      fragmentShader: ATMOSPHERE_FRAGMENT,
      side: BackSide,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
    }),
  );
  scene.add(earth, atmosphere);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.5;
  controls.zoomSpeed = 0.8;
  controls.minDistance = CAMERA_DISTANCE_RANGE.min;
  controls.maxDistance = CAMERA_DISTANCE_RANGE.max;

  const listeners = new Set<(camera: GlobeCamera) => void>();
  let needsRender = true;
  let frame = 0;

  function placeCamera(state: GlobeCamera): void {
    camera.position.set(...cameraPosition(state));
    camera.lookAt(0, 0, 0);
    controls.update();
    needsRender = true;
  }

  function resize(): void {
    const { clientWidth, clientHeight } = container;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / Math.max(clientHeight, 1);
    // Fix the field of view on the narrower side, so a camera distance frames the globe the
    // same way on a portrait phone as on a landscape laptop (and shared links look alike).
    const halfAngle = (NARROW_SIDE_FOV_DEGREES / 2) * (Math.PI / 180);
    camera.fov =
      camera.aspect >= 1
        ? NARROW_SIDE_FOV_DEGREES
        : (2 * Math.atan(Math.tan(halfAngle) / camera.aspect) * 180) / Math.PI;
    camera.updateProjectionMatrix();
    needsRender = true;
  }

  controls.addEventListener('change', () => {
    needsRender = true;
    const state = cameraFromPosition([camera.position.x, camera.position.y, camera.position.z]);
    for (const listener of listeners) listener(state);
  });

  function loop(): void {
    // update() keeps damping going after the pointer is released; it reports movement via 'change'.
    controls.update();
    if (needsRender) {
      needsRender = false;
      renderer.render(scene, camera);
      container.dataset['rendered'] = 'true';
    }
    frame = requestAnimationFrame(loop);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  placeCamera(options.camera);
  loop();

  return {
    canvas: renderer.domElement,
    setSunDirection([x, y, z]) {
      sunDirection.set(x, y, z).normalize();
      needsRender = true;
    },
    setCamera: placeCamera,
    onCameraChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      texture.dispose();
      renderer.domElement.remove();
    },
  };
}
