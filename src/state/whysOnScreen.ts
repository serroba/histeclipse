/**
 * Which whys are on screen (#490): the ground, the bodies and each layer drawn, for the
 * Sources list; and the why of each layer's row in the Layers panel. The
 * whys themselves are in the sources registry.
 */

import { layerEntry, LAYERS } from '../layers/layers';
import type { WhyId } from '../sources/registry';
import type { BorderSource, Layer, Span } from './viewState';

/** What decides what is on screen, for the sources it rests on. */
export interface Scene {
  readonly mode: 'globe' | 'sky';
  readonly span: Span;
  readonly focus: string;
  readonly layers: ReadonlySet<Layer>;
  readonly borders: BorderSource;
  readonly eclipse: boolean;
  /** The layers drawn on each span, as the Layers panel has them. */
  readonly drawsOn: (layer: Layer, span: Span) => boolean;
}

/**
 * The whys of what is on screen: the ground first, then the sky's bodies, then each layer drawn,
 * in the layers' own order, as the chips beside Layers list them (#904).
 */
export function onScreen(scene: Scene): WhyId[] {
  if (scene.mode === 'sky') return ['sky', 'bodies'];
  const ground: WhyId[] =
    scene.focus === 'sun'
      ? ['sun']
      : scene.focus !== 'earth' && scene.span === 'years'
        ? ['close-up', 'bodies']
        : scene.span === 'years'
          ? ['earth', 'bodies']
          : scene.span === 'ice'
            ? ['ice-surface']
            : ['deep-surface', 'deep-evidence'];
  const drawn = LAYERS.filter(
    (layer) => scene.layers.has(layer) && scene.drawsOn(layer, scene.span),
  );
  return [...ground, ...drawn.flatMap((layer) => whysOf(layer, scene))];
}

/** A layer's whys while it is drawn: its own, both sources of borders compared, an eclipse picked. */
function whysOf(layer: Layer, scene: Scene): WhyId[] {
  if (layer === 'eclipses') return scene.eclipse && scene.span === 'years' ? ['eclipses'] : [];
  if (layer === 'empires' && scene.borders === 'both') return ['empires-cliopatria', 'empires-ohm'];
  return [layerWhy(layer, scene.borders)];
}

/** The why for a layer's row in the Layers panel. */
export function layerWhy(layer: Layer, borders: BorderSource): WhyId {
  if (layer === 'empires' && borders === 'ohm') return 'empires-ohm';
  return layerEntry(layer).why;
}
