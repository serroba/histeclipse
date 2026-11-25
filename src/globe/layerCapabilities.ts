/**
 * What a layer on the globe may ask for by name (#938), as a feature does (#909): it is lent
 * those and no others, so what each layer touches is written down with it. Something one or two
 * layers need of the globe is a capability here, not a field of `LayerCore`.
 */

import type { CraftFrame } from './focus';
import type { GlobeLayer, LayerFactory, LayerHost } from './layerHost';
import type { SunImageTextures } from './surfaces';

export interface LayerCapabilities {
  /** Hold a craft where it is now for the camera to orbit (#796), or none. */
  holdCraft(craft: CraftFrame | null): void;
  /** Show these images on the Sun, and the corona from its newest frame; null shows it plain. */
  showSunImage(image: SunImageTextures | null): void;
  /** Draw Earth at `share` of its radius, its air with it: 1 as it is (#1219, Earth growing). */
  earthSize(share: number): void;
}

export type LayerCapability = keyof LayerCapabilities;

/** Every capability, so one not asked for can be held back. */
const CAPABILITIES: Readonly<Record<LayerCapability, true>> = {
  holdCraft: true,
  showSunImage: true,
  earthSize: true,
};

/**
 * What a layer asking for `needs` is given of `host`: all of it but the capabilities it did not
 * name.
 */
export function lend<Core extends object, Needs extends LayerCapability>(
  host: Core & LayerCapabilities,
  needs: readonly Needs[],
): Core & Pick<LayerCapabilities, Needs> {
  const asked = new Set<string>(needs);
  return Object.fromEntries(
    Object.entries(host).filter(([key]) => !(key in CAPABILITIES) || asked.has(key)),
  ) as Core & Pick<LayerCapabilities, Needs>;
}

/** A layer that asks for capabilities by name: it is made with those, and no others. */
export function needing<Input, Needs extends LayerCapability>(
  needs: readonly Needs[],
  make: (host: LayerHost<Needs>) => GlobeLayer<Input>,
): LayerFactory<Input, Needs> {
  return Object.assign(make, { needs });
}

/** The capabilities `factory` asked for, if any. */
export function needsOf(factory: object): readonly LayerCapability[] {
  return 'needs' in factory ? (factory.needs as readonly LayerCapability[]) : [];
}
