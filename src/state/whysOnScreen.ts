/**
 * Which whys are on screen (#490): the ground, the bodies, each layer drawn, the borders and
 * an eclipse, for the Sources list; and the why of each layer's row in the Layers panel. The
 * whys themselves are in the sources registry.
 */

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

/** The layers whose why is their own id. */
const LAYER_WHYS: readonly (Layer & WhyId)[] = [
  'radiocarbon',
  'dates',
  'carbonMade',
  'ways',
  'periods',
  'genomes',
  'rocks',
  'impacts',
  'volcanoes',
  'orbits',
  'spacecraft',
  'asteroids',
  'temperature',
  'sealevel',
  'plates',
  'humans',
  'air',
  'fossils',
];

/** The whys of what is on screen: the ground first, then the sky's bodies, then each layer. */
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
  const layers = (layer: Layer): boolean =>
    scene.layers.has(layer) && scene.drawsOn(layer, scene.span);
  const borders: WhyId[] = !layers('empires')
    ? []
    : scene.borders === 'both'
      ? ['empires-cliopatria', 'empires-ohm']
      : [scene.borders === 'ohm' ? 'empires-ohm' : 'empires-cliopatria'];
  const eclipses: WhyId[] =
    scene.eclipse && scene.span === 'years' && layers('eclipses') ? ['eclipses'] : [];
  return [...ground, ...eclipses, ...borders, ...LAYER_WHYS.filter(layers)];
}

/** The why for a layer's row in the Layers panel. */
export function layerWhy(layer: Layer, borders: BorderSource): WhyId {
  if (layer === 'empires') return borders === 'ohm' ? 'empires-ohm' : 'empires-cliopatria';
  return layer;
}
