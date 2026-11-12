/**
 * Parts of the Earth shader that features bring (#379): each a GLSL function over the colour the
 * shader has so far, with its own uniforms, called in order where the drawings over the lit
 * ground go (after the states, before deep time's even light). The globe builds its shader once
 * from the parts it is given; a part's layer then sets the part's uniforms through the host.
 *
 * A part's GLSL declares its uniforms and one function, `vec3 <name>(vec3 color, EarthFragment
 * f)`, which returns the new colour. `EarthFragment` is what the shader has worked out at that
 * point of the ground.
 */

import type { IUniform } from 'three';

/** A part's uniforms, by name: set their `value`s, never replace them. */
export type PartUniforms = Readonly<Record<string, IUniform>>;

export interface EarthPart<Uniforms extends PartUniforms = PartUniforms> {
  /** Its function's name, and the part's: unique among the parts. */
  readonly name: string;
  /** Where its function is called among the parts, lower first (see EARTH_PART_ORDER). */
  readonly order: number;
  /** Its uniforms' declarations and its function. */
  readonly glsl: string;
  /** Its uniforms, made once for the globe that draws it. */
  uniforms(): Uniforms;
}

/** Where each part is called, lower first; gaps leave room for parts between. */
export const EARTH_PART_ORDER = {
  lunarOverlay: 30,
  eclipsePath: 40,
  moonShadow: 50,
} as const;

/**
 * The globe's own uniforms a part may read, set as the bodies move: where the Sun and Moon are in
 * the scene, their radii (Earth radii; the Moon's 0 until it is placed), and the direction to the
 * Sun. A part declares none of them; the Earth shader does.
 */
export const EARTH_SHARED_UNIFORMS = [
  'sunDirection',
  'sunPosition',
  'sunRadius',
  'moonPosition',
  'moonRadius',
] as const;

/** What the Earth shader has worked out at a point of the ground, for the parts. */
export const EARTH_FRAGMENT_STRUCT = /* glsl */ `
  struct EarthFragment {
    // The ground's own colour, before light.
    vec3 surface;
    // The colour of night there.
    vec3 night;
    // The point on the unit sphere, which is its normal.
    vec3 normal;
    vec2 uv;
    // 0 at night to 1 in full day, through twilight.
    float daylight;
    // Radians.
    float latitude;
    float longitude;
  };
`;

/** Every WebGL GPU allows a fragment shader this many textures; some allow no more. */
export const MAX_SAMPLERS = 16;

/** How many textures a piece of GLSL declares. */
export function samplerCount(glsl: string): number {
  return (glsl.match(/\buniform\s+sampler2D\b/g) ?? []).length;
}

/** The parts' GLSL in call order, the calls themselves, and all their uniforms. */
export interface AssembledParts {
  readonly glsl: string;
  /** Statements that pass `color` through each part in turn, given `f`. */
  readonly calls: string;
  readonly uniforms: Readonly<Record<string, IUniform>>;
  /** Each part's uniforms, the same objects as in `uniforms`. */
  readonly byPart: ReadonlyMap<EarthPart, PartUniforms>;
}

/**
 * Put the parts in order and check them: each named as a GLSL identifier, once, declaring its
 * function, its uniforms clear of the others' and of `taken`.
 */
export function assembleEarthParts(
  parts: readonly EarthPart[],
  taken: ReadonlySet<string> = new Set(),
): AssembledParts {
  const ordered = parts.toSorted((a, b) => a.order - b.order);
  const uniforms: Record<string, IUniform> = {};
  const byPart = new Map<EarthPart, PartUniforms>();
  const names = new Set<string>();
  for (const part of ordered) {
    if (!/^[a-z][A-Za-z0-9]*$/.test(part.name)) {
      throw new Error(`Earth part "${part.name}": its name must be a GLSL function's`);
    }
    if (names.has(part.name)) throw new Error(`Earth part "${part.name}" is given twice`);
    names.add(part.name);
    const signature = new RegExp(
      String.raw`\bvec3\s+${part.name}\s*\(\s*vec3\s+color\s*,\s*EarthFragment\s+f\s*\)`,
    );
    if (!signature.test(part.glsl)) {
      throw new Error(
        `Earth part "${part.name}" must declare vec3 ${part.name}(vec3 color, EarthFragment f)`,
      );
    }
    const redeclared = EARTH_SHARED_UNIFORMS.find((name) =>
      new RegExp(String.raw`\buniform\s+\w+\s+${name}\s*;`).test(part.glsl),
    );
    if (redeclared !== undefined) {
      throw new Error(
        `Earth part "${part.name}" declares ${redeclared}: the Earth shader does, for every part`,
      );
    }
    const own = part.uniforms();
    for (const [name, uniform] of Object.entries(own)) {
      if (taken.has(name) || name in uniforms) {
        throw new Error(`Earth part "${part.name}": the uniform ${name} is taken`);
      }
      uniforms[name] = uniform;
    }
    byPart.set(part, own);
  }
  return {
    glsl: ordered.map(({ glsl }) => glsl).join('\n'),
    calls: ordered.map(({ name }) => `color = ${name}(color, f);`).join('\n    '),
    uniforms,
    byPart,
  };
}

/** Throw if `fragment` samples more textures than every GPU allows, saying how many. */
export function checkSamplers(fragment: string): void {
  const count = samplerCount(fragment);
  if (count > MAX_SAMPLERS) {
    throw new Error(
      `The Earth shader samples ${String(count)} textures; every GPU allows ${String(MAX_SAMPLERS)}`,
    );
  }
}
