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
