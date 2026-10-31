/**
 * GLSL for solar eclipses. Both shaders evaluate the same local-circumstance equations as
 * `eclipses/solar.ts` (which is unit-tested against NASA's path limits); keep them in step.
 *
 * Positions: a texel or fragment gives geodetic latitude/longitude; the observer is placed
 * on the WGS84 ellipsoid (ρ sin φ′, ρ cos φ′) and projected onto the fundamental plane.
 */

/** Shared GLSL: observer coordinates and the shadow radii at a point. */
export const SOLAR_COMMON = /* glsl */ `
  const float POLAR_RATIO = 0.99664719;

  // Fundamental-plane coordinates (xi, eta, zeta) of a sea-level point.
  vec3 observerInPlane(float latitude, float longitude, float d, float mu) {
    float u = atan(POLAR_RATIO * tan(latitude));
    float rhoSin = POLAR_RATIO * sin(u);
    float rhoCos = cos(u);
    float hourAngle = mu + longitude;
    return vec3(
      rhoCos * sin(hourAngle),
      rhoSin * cos(d) - rhoCos * cos(hourAngle) * sin(d),
      rhoSin * sin(d) + rhoCos * cos(hourAngle) * cos(d)
    );
  }
`;

/** Darkens the globe under the Moon's shadow at one instant. Needs SOLAR_COMMON. */
export const SOLAR_SHADOW = /* glsl */ `
  uniform float solarActive;
  uniform vec4 shadowAxis;   // x, y, d (radians), mu (radians, ΔT applied)
  uniform vec4 shadowCones;  // l1, l2, tan f1, tan f2

  // The Moon's shadow uses the night side's own palette, so it reads as "night in daytime":
  // the umbra is fully night-dark, and the penumbra deepens toward it as more of the Sun is
  // covered.
  vec3 solarShadowLayer(vec3 color, vec3 night, float latitude, float longitude) {
    vec3 observer = observerInPlane(latitude, longitude, shadowAxis.z, shadowAxis.w);
    if (observer.z <= 0.0) return color;
    float penumbra = shadowCones.x - observer.z * shadowCones.z;
    float umbra = shadowCones.y - observer.z * shadowCones.w;
    float axisDistance = length(shadowAxis.xy - observer.xy);
    float magnitude = clamp((penumbra - axisDistance) / (penumbra + umbra), 0.0, 1.0);
    // Exaggerated on purpose, so the shadow reads as night in daytime. The brightness is
    // chosen perceptually and then linearised (gamma 2.2): the output is sRGB-encoded, so a
    // linear dimming that looks dark on paper looks faint on screen.
    float perceived = 1.0 - 0.9 * pow(magnitude, 0.6);
    vec3 shaded = max(color * pow(perceived, 2.2), night);
    // The umbra itself is full night.
    float core = 1.0 - smoothstep(abs(umbra) * 0.6, abs(umbra) * 1.15, axisDistance);
    shaded = mix(shaded, night, core);
    return mix(color, shaded, solarActive);
  }
`;

/** Paints the eclipse path into an equirectangular texture. Needs SOLAR_COMMON. */
export const SOLAR_PATH_FRAGMENT = /* glsl */ `
  uniform vec4 coefficientsX;
  uniform vec4 coefficientsY;
  uniform vec4 coefficientsD;   // radians
  uniform vec4 coefficientsMu;  // radians, ephemeris hour angle
  uniform vec4 coefficientsL1;
  uniform vec4 coefficientsL2;
  uniform vec2 tangents;        // tan f1, tan f2
  uniform vec3 muShifts;        // radians to subtract for ΔT, ΔT − σ, ΔT + σ
  uniform float halfSpanHours;
  varying vec2 vUv;

  float poly(vec4 c, float h) { return c.x + h * (c.y + h * (c.z + h * c.w)); }

  // Distance from the shadow axis minus the umbra radius at time h, for one ΔT.
  // Returns (axis distance - |umbra|, magnitude); a huge distance when the Sun is down.
  vec2 at(float h, float latitude, float longitude, float muShift) {
    float d = poly(coefficientsD, h);
    vec3 observer = observerInPlane(latitude, longitude, d, poly(coefficientsMu, h) - muShift);
    if (observer.z <= 0.0) return vec2(1e3, 0.0);
    float penumbra = poly(coefficientsL1, h) - observer.z * tangents.x;
    float umbra = poly(coefficientsL2, h) - observer.z * tangents.y;
    float axisDistance = length(vec2(poly(coefficientsX, h), poly(coefficientsY, h)) - observer.xy);
    return vec2(axisDistance - abs(umbra), (penumbra - axisDistance) / (penumbra + umbra));
  }

  // Closest approach of the umbra to this point over the fitted span: a coarse scan, then
  // a ternary refinement around the best step.
  vec2 closest(float latitude, float longitude, float muShift) {
    const int COARSE = 48;
    float stride = 2.0 * halfSpanHours / float(COARSE);
    float bestH = -halfSpanHours;
    vec2 best = at(bestH, latitude, longitude, muShift);
    for (int i = 1; i <= COARSE; i++) {
      float h = -halfSpanHours + float(i) * stride;
      vec2 value = at(h, latitude, longitude, muShift);
      if (value.x < best.x) { best = value; bestH = h; }
    }
    float low = max(-halfSpanHours, bestH - stride);
    float high = min(halfSpanHours, bestH + stride);
    for (int i = 0; i < 14; i++) {
      float a = mix(low, high, 1.0 / 3.0);
      float b = mix(low, high, 2.0 / 3.0);
      if (at(a, latitude, longitude, muShift).x < at(b, latitude, longitude, muShift).x) high = b;
      else low = a;
    }
    vec2 refined = at(0.5 * (low + high), latitude, longitude, muShift);
    return refined.x < best.x ? refined : best;
  }

  void main() {
    float longitude = (vUv.x * 2.0 - 1.0) * 3.14159265358979;
    float latitude = (vUv.y - 0.5) * 3.14159265358979;
    vec2 nominal = closest(latitude, longitude, muShifts.x);
    float west = step(closest(latitude, longitude, muShifts.y).x, 0.0);
    float east = step(closest(latitude, longitude, muShifts.z).x, 0.0);
    // R, G, B: in the path for ΔT, ΔT − σ, ΔT + σ. A: deepest partial eclipse (nominal ΔT).
    gl_FragColor = vec4(step(nominal.x, 0.0), west, east, clamp(nominal.y, 0.0, 1.0));
  }
`;

/** Draws the path texture over the globe. Needs a `solarPath` sampler and `solarPathActive`. */
export const SOLAR_PATH_LAYER = /* glsl */ `
  uniform sampler2D solarPath;
  uniform float solarPathActive;

  vec3 solarPathLayer(vec3 color, vec2 uv) {
    vec4 path = texture2D(solarPath, uv);
    float certain = path.r * path.g * path.b;
    float possible = max(max(path.r, path.g), path.b);
    float uncertain = possible - certain;
    float hatch = step(0.55, fract((gl_FragCoord.x - gl_FragCoord.y) / 10.0));
    vec3 tint = vec3(0.98, 0.83, 0.42);
    vec3 painted = mix(color, color * 0.75 + tint * 0.25, certain * 0.6);
    painted = mix(painted, color * 0.75 + tint * 0.22, uncertain * hatch * 0.85);
    // The limits of the partial eclipse: a thin, dashed, pale-blue line, so it can't be mistaken
    // for the path of totality.
    float limit = smoothstep(0.0, 0.002, path.a) * (1.0 - smoothstep(0.004, 0.008, path.a));
    float dash = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) / 14.0));
    painted = mix(painted, vec3(0.62, 0.78, 1.0), limit * dash * 0.7);
    return mix(color, painted, solarPathActive);
  }
`;

/**
 * The share of the Sun's disc a point sees past a dark sphere: the GLSL twin of
 * `astro/occultation.ts`, which is the tested reference.
 */
export const OCCULTATION = /* glsl */ `
  float visibleFraction(float source, float occluder, float separation) {
    if (separation >= source + occluder) return 1.0;
    if (separation <= occluder - source) return 0.0;
    if (separation <= source - occluder) return 1.0 - (occluder * occluder) / (source * source);
    float d = separation;
    float alpha = acos(clamp((d * d + source * source - occluder * occluder) / (2.0 * d * source), -1.0, 1.0));
    float beta = acos(clamp((d * d + occluder * occluder - source * source) / (2.0 * d * occluder), -1.0, 1.0));
    float lens = source * source * (alpha - sin(2.0 * alpha) / 2.0)
      + occluder * occluder * (beta - sin(2.0 * beta) / 2.0);
    return 1.0 - lens / (3.14159265 * source * source);
  }

  float sunlightAt(vec3 point, vec3 sun, float sunRadius, vec3 occluder, float occluderRadius) {
    vec3 toSun = sun - point;
    vec3 toOccluder = occluder - point;
    float occluderDistance = length(toOccluder);
    if (occluderDistance <= occluderRadius || dot(toSun, toOccluder) <= 0.0) return 1.0;
    float separation = atan(length(cross(toSun, toOccluder)), dot(toSun, toOccluder));
    return visibleFraction(
      asin(min(1.0, sunRadius / length(toSun))),
      asin(occluderRadius / occluderDistance),
      separation
    );
  }
`;
