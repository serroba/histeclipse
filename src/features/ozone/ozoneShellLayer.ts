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

import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  ShaderMaterial,
  Uint32BufferAttribute,
} from 'three';

import type { ShellField } from '../../data/ozoneShell';
import type { LayerFactory } from '../../globe/layerHost';
import { shellMesh } from './shellMesh';

const VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute vec3 color;
  varying vec3 vColour;
  varying vec3 vViewNormal;
  varying vec3 vViewPosition;
  void main() {
    vColour = color;
    vViewNormal = normalize(normalMatrix * normal);
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = viewPosition.xyz;
    gl_Position = projectionMatrix * viewPosition;
    #include <logdepthbuf_vertex>
  }
`;

const FRAGMENT = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  varying vec3 vColour;
  varying vec3 vViewNormal;
  varying vec3 vViewPosition;
  void main() {
    #include <logdepthbuf_fragment>
    // Lit from the eye, so its folds show whichever way it is turned; its inner face darker.
    float facing = abs(dot(normalize(vViewNormal), normalize(-vViewPosition)));
    float light = (gl_FrontFacing ? 0.5 : 0.32) + 0.5 * facing;
    gl_FragColor = vec4(vColour * light, 1.0);
  }
`;

/** A day's surface; null takes it away. */
export const ozoneShellLayer: LayerFactory<ShellField | null> = (host) => {
  const geometry = new BufferGeometry();
  const mesh = new Mesh(
    geometry,
    new ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, side: DoubleSide }),
  );
  mesh.name = 'ozone-shell';
  mesh.visible = false;
  mesh.frustumCulled = false;
  host.onEarth.add(mesh);
  let shown: ShellField | null = null;
  return {
    update(field) {
      host.container.dataset['ozoneShell'] = field === null ? 'off' : 'on';
      if (field === shown) return;
      shown = field;
      mesh.visible = field !== null;
      if (field !== null) {
        const made = shellMesh(field);
        geometry.setAttribute('position', new Float32BufferAttribute(made.positions, 3));
        geometry.setAttribute('color', new Float32BufferAttribute(made.colours, 3));
        geometry.setIndex(new Uint32BufferAttribute(made.triangles, 1));
        geometry.computeVertexNormals();
        host.container.dataset['ozoneShellTriangles'] = String(made.triangles.length / 3);
      }
      host.requestRender();
    },
  };
};
