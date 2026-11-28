/**
 * The giant impact and the Moon gathering on the globe (#180), the canonical case: Theia coming
 * in, the flash where it strikes, the debris thrown into an arm that settles into a glowing disc
 * round Earth's equator, and the Moon gathering from it, molten, then cooling. Where each is at a
 * moment, `impactModel.ts` says; this draws it, turned so the strike faces the reader when it opens.
 *
 * The disc and the Moon turn with the time between the clock's moments, so they move while it
 * plays and stand still when it is paused; for a reader who asks for less motion, they stand
 * still. A layer on the globe's host: `globe.addLayer(impactLayer)`, given seconds since the
 * impact, or null.
 *
 * Three.js glue, covered by the Playwright suite.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  Points,
  PointsMaterial,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';

import { glowTexture } from '../../globe/glowTexture';
import type { LayerFactory } from '../../globe/layerHost';
import {
  flashAt,
  moonAt,
  pieceAt,
  pieces,
  strikeAngle,
  THEIA_RADIUS,
  theiaAt,
  type Piece,
} from './impactModel';
import { glowColour, moonColour } from './heatColour';
import type { Hit } from '../../deepTime/theia';
import { innerDisc } from './innerDisc';

/** Pieces of debris drawn: fewer on a phone. */
const PIECES = 800;
const PHONE_PIECES = 300;
/** A piece's size, Earth radii. */
const PIECE_SIZE = 0.22;
/** How far round from the reader the strike is turned: towards the limb, where the arm shows. */
const STRIKE_TURN = 0.5;

/** A round body shaded darker at its edge, as if lit from the reader's side. */
function bodyMaterial(colour: Color): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { colour: { value: colour }, opacity: { value: 1 } },
    transparent: true,
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 colour;
      uniform float opacity;
      varying vec3 vNormal;
      void main() {
        float lit = 0.35 + 0.65 * max(0.0, vNormal.z);
        gl_FragColor = vec4(colour * lit, opacity);
      }`,
  });
}

interface Drawing {
  readonly group: Group;
  readonly theia: Mesh<SphereGeometry, ShaderMaterial>;
  readonly moon: Mesh<SphereGeometry, ShaderMaterial>;
  /** The Moon's colour, its material's own. */
  readonly moonColour: Color;
  readonly moonGlow: Sprite;
  readonly flash: Sprite;
  readonly debris: Points<BufferGeometry, PointsMaterial>;
  readonly dispose: () => void;
}

function glowSprite(map: ReturnType<typeof glowTexture>): Sprite {
  return new Sprite(
    new SpriteMaterial({ map, transparent: true, depthWrite: false, blending: AdditiveBlending }),
  );
}

function makeDrawing(count: number): Drawing {
  const map = glowTexture(false);
  const group = new Group();
  group.visible = false;
  const theia = new Mesh(
    new SphereGeometry(THEIA_RADIUS, 32, 16),
    bodyMaterial(new Color(0.42, 0.27, 0.2)),
  );
  const shade = new Color();
  const moon = new Mesh(new SphereGeometry(1, 32, 16), bodyMaterial(shade));
  const moonGlow = glowSprite(map);
  const flash = glowSprite(map);
  flash.material.color.setRGB(1, 0.85, 0.6);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(count * 3), 3));
  const debris = new Points(
    geometry,
    new PointsMaterial({
      size: PIECE_SIZE,
      map,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  );
  // Its points move every moment: no bounds to keep.
  debris.frustumCulled = false;
  group.add(theia, moon, moonGlow, flash, debris);
  return {
    group,
    theia,
    moon,
    moonColour: shade,
    moonGlow,
    flash,
    debris,
    dispose() {
      map.dispose();
      theia.geometry.dispose();
      theia.material.dispose();
      moon.geometry.dispose();
      moon.material.dispose();
      moonGlow.material.dispose();
      flash.material.dispose();
      geometry.dispose();
      debris.material.dispose();
      group.removeFromParent();
    },
  };
}

/** Place each piece of debris at `seconds`, its colour dimmed as it fades. */
function placeDebris(
  debris: Drawing['debris'],
  made: readonly Piece[],
  { seconds, hit }: ImpactMoment,
  played: number,
): number {
  const positions = debris.geometry.getAttribute('position') as BufferAttribute;
  const colours = debris.geometry.getAttribute('color') as BufferAttribute;
  let shown = 0;
  made.forEach((piece, index) => {
    const at = pieceAt(piece, seconds, played, hit);
    if (at === null) {
      // Out of sight, at the centre inside Earth.
      positions.setXYZ(index, 0, 0, 0);
      colours.setXYZ(index, 0, 0, 0);
      return;
    }
    shown += 1;
    const [r, g, b] = glowColour(at.heat);
    positions.setXYZ(index, ...at.place);
    colours.setXYZ(index, r * at.opacity, g * at.opacity, b * at.opacity);
  });
  positions.needsUpdate = true;
  colours.needsUpdate = true;
  return shown;
}

/** What the layer is drawing, for the page to say: 'off', 'theia', 'debris' or 'moon'. */
function stage(seconds: number): string {
  if (seconds < 0) return 'theia';
  return seconds < 86_400 ? 'debris' : 'moon';
}

/** The impact at a moment: seconds since it, and the hit chosen (#1220). */
export interface ImpactMoment {
  readonly seconds: number;
  readonly hit: Hit;
}

export const impactLayer: LayerFactory<ImpactMoment | null> = (host) => {
  const lessMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const phone = window.matchMedia('(pointer: coarse)').matches;
  const made = pieces(phone ? PHONE_PIECES : PIECES);
  const drawing = makeDrawing(made.length);
  const { group, theia, moon, moonGlow, flash, debris } = drawing;
  const shade = drawing.moonColour;
  const sheet = innerDisc(host);
  group.add(sheet.group);
  host.spinAxis.add(group);
  let played = 0;
  let last: number | null = null;
  const camera = new Vector3();

  /** Turn the scene so `hit`'s strike faces the reader, towards the limb. */
  function face(hit: Hit): void {
    host.spinAxis.updateMatrixWorld();
    camera.copy(host.camera.position);
    host.spinAxis.worldToLocal(camera);
    group.rotation.y = Math.atan2(-camera.z, camera.x) + STRIKE_TURN - strikeAngle(hit);
  }

  return {
    update(moment) {
      host.container.dataset['formationImpact'] = moment === null ? 'off' : stage(moment.seconds);
      if (moment === null) {
        group.visible = false;
        sheet.update(null);
        last = null;
        host.requestRender();
        return;
      }
      // Turned to the reader until it strikes, while the camera settles; then held.
      const { seconds, hit } = moment;
      if (seconds < 0 || !group.visible) face(hit);
      group.visible = true;
      // The disc turns with the time between moments, a late frame counting a fifth of a second.
      const now = performance.now();
      if (last !== null && !lessMotion.matches) played += Math.min(0.2, (now - last) / 1000);
      last = now;

      const body = theiaAt(seconds, hit);
      theia.visible = body !== null;
      if (body !== null) {
        theia.position.set(...body.center);
        theia.scale.setScalar(body.scale);
        if (theia.material.uniforms['opacity'] !== undefined)
          theia.material.uniforms['opacity'].value = body.opacity;
      }

      const light = flashAt(seconds, hit);
      flash.visible = light !== null;
      if (light !== null) {
        flash.position.set(...light.place);
        flash.scale.setScalar(light.size);
        flash.material.opacity = light.glow;
      }

      const shown = placeDebris(debris, made, moment, played);
      debris.visible = shown > 0;

      const gathered = moonAt(seconds, played, hit);
      sheet.update(moment, gathered?.place ?? null);
      moon.visible = gathered !== null;
      moonGlow.visible = gathered !== null && gathered.heat > 0;
      if (gathered !== null) {
        moon.position.set(...gathered.place);
        moon.scale.setScalar(gathered.radius);
        shade.setRGB(...moonColour(gathered.heat));
        moonGlow.position.copy(moon.position);
        moonGlow.scale.setScalar(gathered.radius * 4);
        moonGlow.material.color.setRGB(...glowColour(gathered.heat));
        moonGlow.material.opacity = 0.6 * gathered.heat;
      }
      host.requestRender();
    },
    dispose() {
      sheet.dispose();
      drawing.dispose();
    },
  };
};
