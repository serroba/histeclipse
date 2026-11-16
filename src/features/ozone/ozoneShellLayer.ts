/**
 * The ozone layer as a surface round the Earth (#804), in the globe's own scene: a shell raised
 * off the globe, its lower and upper faces where ozone's partial pressure is 12 mPa, coloured by
 * total ozone as the flat map is, and open where no height holds that much ozone. It turns with
 * the Earth. Heights are drawn larger than life (`shellRadius`), or the layer, a few km thick,
 * could not be told from the ground.
 *
 * Three.js glue, covered by the Playwright suite; the surface's numbers are in
 * `data/ozoneShell`, the mesh's in `shellMesh`.
 */

import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, ShaderMaterial } from 'three';

import type { ShellField } from '../../data/ozoneShell';
import type { LayerFactory } from '../../globe/layerHost';
import { createShellMesher, type ShellMesh } from './shellMesh';

const VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute vec3 color;
  varying vec3 vColour;
  varying vec3 vViewPosition;
  void main() {
    vColour = color;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = viewPosition.xyz;
    gl_Position = projectionMatrix * viewPosition;
    #include <logdepthbuf_vertex>
  }
`;

/** How much of the surface shows, 0 to 1: less than all, so the land and the sea show faintly
 * through it (#817). */
const SEE_THROUGH = '0.58';

const FRAGMENT = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  varying vec3 vColour;
  varying vec3 vViewPosition;
  void main() {
    #include <logdepthbuf_fragment>
    // Lit from the eye, so its folds show whichever way it is turned; its inner face darker.
    // Each triangle's own facing, from the screen's derivatives: no normals to work out (#819).
    vec3 normal = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
    float facing = abs(dot(normal, normalize(-vViewPosition)));
    float light = (gl_FrontFacing ? 0.5 : 0.32) + 0.5 * facing;
    gl_FragColor = vec4(vColour * light, ${SEE_THROUGH});
  }
`;

/**
 * Put a day's mesh in the geometry: its buffers are the same from day to day, so the attributes
 * are kept and only flagged to be sent again; made anew only when a buffer was (the first day,
 * a finer grid, a bigger room for triangles).
 */
function fill(geometry: BufferGeometry, made: ShellMesh): void {
  if (
    geometry.hasAttribute('position') &&
    geometry.getAttribute('position').array === made.positions
  ) {
    geometry.getAttribute('position').needsUpdate = true;
    geometry.getAttribute('color').needsUpdate = true;
  } else {
    // BufferAttribute keeps the array it is given, as Float32BufferAttribute copies it.
    geometry.setAttribute('position', new BufferAttribute(made.positions, 3));
    geometry.setAttribute('color', new BufferAttribute(made.colours, 3));
  }
  const index = geometry.getIndex();
  if (index?.array === made.room) index.needsUpdate = true;
  else geometry.setIndex(new BufferAttribute(made.room, 1));
  geometry.setDrawRange(0, made.triangles.length);
}

/** How many triangles the geometry draws. */
function drawn(geometry: BufferGeometry): number {
  return geometry.drawRange.count / 3;
}

/** A day's surface; null takes it away. */
export const ozoneShellLayer: LayerFactory<ShellField | null> = (host) => {
  const geometry = new BufferGeometry();
  const mesh = new Mesh(
    geometry,
    new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      side: DoubleSide,
      transparent: true,
      depthWrite: false,
    }),
  );
  mesh.name = 'ozone-shell';
  mesh.visible = false;
  mesh.frustumCulled = false;
  host.onEarth.add(mesh);
  const mesher = createShellMesher();
  let shown: ShellField | null = null;
  return {
    update(field) {
      host.container.dataset['ozoneShell'] = field === null ? 'off' : 'on';
      if (field === shown) return;
      shown = field;
      mesh.visible = field !== null;
      if (field !== null) fill(geometry, mesher(field));
      if (field !== null) host.container.dataset['ozoneShellTriangles'] = String(drawn(geometry));
      host.requestRender();
    },
  };
};
