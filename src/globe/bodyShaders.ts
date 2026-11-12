/**
 * The shaders of the globe's other bodies (#379): the Moon (lit by the Sun, and in eclipse), the
 * Sun (its disc, and an image of it when one is shown), the corona, and Earth's atmosphere.
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

export const SUN_VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vNormal = normal;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

// The whole surface wears SDO's map, stitched from frames days apart, turned so the side facing
// Earth is the newest frame's (sunImage.ts is the tested reference). The map is the surface
// seen face-on; visible light darkens toward the limb as the camera sees it, so the disc looks
// round from any side.
export const SUN_FRAGMENT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D surface;
  uniform float hasMap;
  uniform vec3 toEarth;
  uniform vec3 north;
  uniform vec3 tint;
  uniform float limbDarkening;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    #include <logdepthbuf_fragment>
    vec3 plain = vec3(1.0, 0.96, 0.86);
    vec3 n = normalize(vNormal);
    vec3 meridian = normalize(toEarth - dot(toEarth, north) * north);
    vec3 west = cross(north, meridian);
    float latitude = asin(clamp(dot(n, north), -1.0, 1.0));
    float longitude = atan(dot(n, west), dot(n, meridian));
    vec2 uv = vec2(0.5 + longitude / PI2, 0.5 + latitude / PI);
    // On the far side's meridian u jumps from 1 back to 0, which would pick the coarsest
    // mipmap along a seam. A copy of u that jumps on the near side instead gives the right
    // footprint there; use whichever changes less across the pixel.
    float shifted = fract(uv.x + 0.5);
    vec2 dx = dFdx(uv);
    vec2 dy = dFdy(uv);
    float dxShifted = dFdx(shifted);
    float dyShifted = dFdy(shifted);
    if (abs(dxShifted) < abs(dx.x)) dx.x = dxShifted;
    if (abs(dyShifted) < abs(dy.x)) dy.x = dyShifted;
    float towardCamera = clamp(dot(n, normalize(cameraPosition - vWorldPosition)), 0.0, 1.0);
    float darkening = 1.0 - limbDarkening * (1.0 - towardCamera);
    vec3 seen = textureGrad(surface, uv, dx, dy).rgb * tint * darkening;
    gl_FragColor = vec4(mix(plain, seen, hasMap), 1.0);
    #include <colorspace_fragment>
  }
`;

export const CORONA_VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

// What the image shows beyond the limb (the corona, prominences), on a plane across the line of
// sight. It is only right seen from near Earth's side, so it fades as the camera swings away.
export const CORONA_FRAGMENT = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D map;
  uniform float diskRadius;
  uniform float opacity;
  uniform vec3 tint;
  varying vec2 vUv;

  void main() {
    #include <logdepthbuf_fragment>
    float r = length(vUv - 0.5);
    if (r < diskRadius * 0.995) discard;
    // Fade out before the frame's square edge.
    float edge = 1.0 - smoothstep(0.38, 0.49, r);
    gl_FragColor = vec4(texture2D(map, vUv).rgb * tint * opacity * edge, 1.0);
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
    float rim = pow(clamp(0.92 + dot(vViewNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 4.0);
    float sunlit = smoothstep(-0.35, 0.35, dot(normalize(vWorldNormal), sunDirection));
    sunlit = mix(sunlit, 0.75, evenLight);
    vec3 color = vec3(0.3, 0.55, 1.0) * rim * (0.08 + 0.62 * sunlit);
    gl_FragColor = vec4(color, 1.0);
  }
`;
