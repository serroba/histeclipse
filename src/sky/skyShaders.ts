/**
 * The sky's shaders: stars and planets, the figures' lines, the dome, the Sun and its glow,
 * the ground and the Moon. Each projects as the sky does (see projection.ts).
 */

import { SKY_PROJECTION, SKY_UNPROJECTION } from './projection';

export const STAR_VERTEX = /* glsl */ `
  ${SKY_PROJECTION}
  attribute float magnitude;
  attribute vec3 color;
  uniform float limit;
  uniform float pixelRatio;
  uniform float zoom;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 direction = normalize(position);
    float altitude = degrees(asin(clamp(direction.y, -1.0, 1.0)));
    // Extinction: the air dims stars toward the horizon (Kasten & Young air mass).
    float h = max(altitude, 0.0);
    float airmass = 1.0 / (sin(radians(h)) + 0.50572 * pow(h + 6.07995, -1.6364));
    float seen = magnitude + 0.2 * (airmass - 1.0);
    float margin = limit - seen;
    vAlpha = altitude < -0.5 ? 0.0 : clamp(margin / 1.5, 0.0, 1.0);
    gl_PointSize = vAlpha > 0.0 ? clamp(1.5 + 1.2 * margin, 1.5, 9.0) * pixelRatio * zoom : 0.0;
    vColor = color;
    gl_Position = skyProject((modelViewMatrix * vec4(position, 1.0)).xyz);
  }
`;

export const STAR_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float core = pow(clamp(1.0 - d, 0.0, 1.0), 1.6);
    gl_FragColor = vec4(vColor * vAlpha * core, 1.0);
  }
`;

export const LINE_VERTEX = /* glsl */ `
  ${SKY_PROJECTION}
  varying float vAltitude;
  void main() {
    vAltitude = normalize(position).y;
    gl_Position = skyProject((modelViewMatrix * vec4(position, 1.0)).xyz);
  }
`;

export const LINE_FRAGMENT = /* glsl */ `
  uniform float opacity;
  varying float vAltitude;
  void main() {
    if (vAltitude < 0.0) discard;
    gl_FragColor = vec4(0.47, 0.62, 1.0, opacity);
  }
`;

// The dome and the ground are spheres around the observer that only need to cover the
// screen: each fragment works out its own direction from where it is on screen, so the
// horizon is exact however coarse the mesh.
export const DOME_VERTEX = /* glsl */ `
  ${SKY_PROJECTION}
  void main() {
    gl_Position = skyProject((modelViewMatrix * vec4(position, 1.0)).xyz);
  }
`;

// The direction under this fragment, in the scene's axes (the dome and ground sit at the
// origin unturned, so undoing the view's rotation is enough).
const FRAGMENT_DIRECTION = /* glsl */ `
  ${SKY_UNPROJECTION}
  vec3 fragmentDirection() {
    return normalize(transpose(mat3(viewMatrix)) * skyViewDirection());
  }
`;

// A disc that faces the viewer, the Sun's glow or the corona: \`extent\` is its full angular
// width in radians.
export const GLOW_VERTEX = /* glsl */ `
  ${SKY_PROJECTION}
  uniform float extent;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 centre = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    gl_Position = skyProjectSprite(centre, position.xy * extent);
  }
`;

export const GLOW_FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  uniform float opacity;
  varying vec2 vUv;
  void main() {
    vec4 texel = texture2D(map, vUv);
    gl_FragColor = linearToOutputTexel(vec4(texel.rgb, texel.a * opacity));
  }
`;

export const SUN_VERTEX = /* glsl */ `
  ${SKY_PROJECTION}
  void main() {
    gl_Position = skyProject((modelViewMatrix * vec4(position, 1.0)).xyz);
  }
`;

export const SUN_FRAGMENT = /* glsl */ `
  uniform vec3 color;
  void main() {
    gl_FragColor = linearToOutputTexel(vec4(color, 1.0));
  }
`;

// Day blue, twilight glow toward the Sun, and night: rough, but the order of things is right.
export const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 sunDirection;
  uniform float sunAltitude;
  uniform float sunlight;
  ${FRAGMENT_DIRECTION}

  void main() {
    vec3 direction = fragmentDirection();
    // An eclipse dims the day: little until most of the Sun is covered, then fast.
    float day = smoothstep(-18.0, 8.0, sunAltitude) * pow(sunlight, 0.4);
    vec3 night = vec3(0.006, 0.009, 0.02);
    vec3 zenith = mix(night, vec3(0.16, 0.33, 0.68), day);
    vec3 horizon = mix(vec3(0.014, 0.018, 0.032), vec3(0.62, 0.74, 0.9), day);
    float up = clamp(direction.y, 0.0, 1.0);
    vec3 color = mix(horizon, zenith, pow(up, 0.45));
    float toSun = max(dot(direction, sunDirection), 0.0);
    float twilight = smoothstep(-14.0, -2.0, sunAltitude) * (1.0 - smoothstep(4.0, 14.0, sunAltitude));
    color += vec3(0.95, 0.45, 0.18) * twilight * pow(toSun, 6.0) * (1.0 - up) * 0.9;
    color += vec3(1.0, 0.95, 0.85) * pow(toSun, 400.0) * 0.6 * step(-1.0, sunAltitude) * sunlight;
    // In totality, sunset colours all around the horizon: beyond the shadow it is still day.
    float totality = (1.0 - smoothstep(0.0, 0.02, sunlight)) * step(-1.0, sunAltitude);
    color += vec3(0.85, 0.42, 0.16) * totality * pow(1.0 - up, 8.0) * 0.5;
    gl_FragColor = vec4(color, 1.0);
  }
`;

export const GROUND_FRAGMENT = /* glsl */ `
  uniform float sunAltitude;
  uniform float sunlight;
  ${FRAGMENT_DIRECTION}

  void main() {
    vec3 direction = fragmentDirection();
    // The horizon is a curve on screen: soften it over a pixel rather than leave stairs.
    float edge = clamp(0.5 - direction.y / max(fwidth(direction.y), 1e-6), 0.0, 1.0);
    if (edge <= 0.0) discard;
    float day = smoothstep(-12.0, 8.0, sunAltitude) * pow(sunlight, 0.4);
    vec3 color = mix(vec3(0.008, 0.009, 0.011), vec3(0.17, 0.15, 0.11), day);
    // A little haze along the horizon line, so the edge reads as distance.
    color += vec3(0.04, 0.05, 0.07) * (0.3 + day) * exp(min(direction.y, 0.0) * 60.0);
    gl_FragColor = vec4(color, edge);
  }
`;

export const MOON_VERTEX = /* glsl */ `
  ${SKY_PROJECTION}
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = skyProject((viewMatrix * world).xyz);
  }
`;

// Sunlit where the surface faces the Sun, copper-dark where Earth's shadow falls on it (Earth
// shadow is drawn from the true geometry, in km). The night side is faint earthshine at night,
// and over the Sun's disc it is black: that is the Moon's silhouette in a solar eclipse.
export const MOON_FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 sunDirection;
  uniform vec3 moonCentre;
  uniform vec3 moonKm;
  uniform float kmPerUnit;
  uniform vec3 antiSun;
  uniform float umbraSlope;
  uniform float penumbraSlope;
  uniform float earthRadius;
  uniform float sunAngularRadius;
  uniform float night;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorld;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 albedo = texture2D(map, vUv).rgb;
    float lit = smoothstep(-0.02, 0.06, dot(normal, sunDirection));

    // This point of the Moon in km from Earth's centre, and where it sits in Earth's shadow.
    vec3 point = moonKm + (vWorld - moonCentre) * kmPerUnit;
    float along = dot(point, antiSun);
    float across = length(point - along * antiSun);
    float umbra = earthRadius - along * umbraSlope;
    float penumbra = earthRadius + along * penumbraSlope;
    float light = along > 0.0 ? smoothstep(umbra, penumbra, across) : 1.0;
    // Red light bent through Earth's atmosphere still reaches the umbra.
    vec3 sunlit = albedo * mix(vec3(0.5, 0.17, 0.07), vec3(1.0), light);

    vec3 view = normalize(vWorld);
    // Only where it covers the bright disc: elsewhere the dark side is lost in the glare.
    float toSun = atan(length(cross(view, sunDirection)), dot(view, sunDirection));
    float nearSun = 1.0 - smoothstep(sunAngularRadius * 0.98, sunAngularRadius * 1.04, toSun);
    vec3 dark = albedo * 0.02 * night;
    float alpha = max(lit, max(nearSun, night * 0.9));
    gl_FragColor = vec4(mix(dark, sunlit * 1.15, lit), alpha);
  }
`;
