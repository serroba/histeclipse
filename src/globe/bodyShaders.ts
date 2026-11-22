/**
 * The shaders of the Moon (lit by the Sun, and in eclipse) and of Earth's atmosphere (#379). The
 * Sun's and the corona's are in sunShaders.ts.
 */

import { OCCULTATION } from './solarShaders';

export const MOON_VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
    #include <logdepthbuf_vertex>
  }
`;

// The Moon lit by the Sun, darkened by Earth's shadow where Earth covers part or all of the
// Sun (Earth at the scene's origin). In the umbra, sunlight bent through Earth's atmosphere
// still reaches the Moon and turns it copper; its brightness here is chosen to be visible.
export const MOON_FRAGMENT = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  ${OCCULTATION}
  uniform sampler2D map;
  uniform vec3 sunPosition;
  uniform float sunRadius;
  uniform float earthRadius;
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  void main() {
    #include <logdepthbuf_fragment>
    vec3 albedo = texture2D(map, vUv).rgb;
    float facing = max(dot(normalize(vWorldNormal), normalize(sunPosition - vWorldPosition)), 0.0);
    float sunlight = sunlightAt(vWorldPosition, sunPosition, sunRadius, vec3(0.0), earthRadius);
    vec3 copper = vec3(0.55, 0.16, 0.06) * 0.22 * pow(1.0 - sunlight, 3.0);
    gl_FragColor = vec4(albedo * facing * (sunlight + copper), 1.0);
    #include <colorspace_fragment>
  }
`;

export const ATMOSPHERE_VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vViewNormal;
  varying vec3 vWorldNormal;
  void main() {
    vViewNormal = normalize(normalMatrix * normal);
    vWorldNormal = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

export const ATMOSPHERE_FRAGMENT = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  uniform vec3 sunDirection;
  uniform float evenLight;
  varying vec3 vViewNormal;
  varying vec3 vWorldNormal;
  void main() {
    #include <logdepthbuf_fragment>
    // A wide band thinning smoothly outward (#1098), not a ribbon: the lower power and offset
    // keep the glow falling off the whole way, so no edge shows where it ends.
    float rim = pow(clamp(0.90 + dot(vViewNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 2.5);
    float sunAltitude = dot(normalize(vWorldNormal), sunDirection);
    float sunlit = smoothstep(-0.35, 0.35, sunAltitude);
    sunlit = mix(sunlit, 0.75, evenLight);
    // The day limb a pale blue-white, the night a whisper of blue, and the terminator warmed
    // to amber, the glow sunsets paint the limb with; deep time's even light has no Sun side,
    // so no warmth there.
    vec3 blue = mix(vec3(0.25, 0.45, 0.95), vec3(0.6, 0.75, 1.0), sunlit);
    float terminator = exp(-pow(sunAltitude / 0.15, 2.0)) * (1.0 - evenLight);
    vec3 color = mix(blue, vec3(1.0, 0.55, 0.25), terminator * 0.6);
    gl_FragColor = vec4(color * rim * (0.05 + 0.5 * sunlit), 1.0);
  }
`;
