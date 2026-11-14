/**
 * SDO's view of the Sun on the globe's Sun (#379): a channel's map of the whole surface and its
 * newest frame (for the corona), small first so something shows at once, then large. The globe
 * shows the textures it is given (`host.showSunImage`); this layer loads them, keeps them, and
 * lets a later request (another channel) win over a slow one.
 */

import { RepeatWrapping, SRGBColorSpace, type Texture } from 'three';

import { loadPicture } from '../../globe/pictureTexture';

import type { LayerFactory, LayerHost } from '../../globe/layerHost';

interface ImagePair {
  readonly small: string;
  readonly large: string;
}

/**
 * SDO's view of the Sun in one channel: a map of the whole surface (see `data/sunImages.ts`),
 * and the newest frame, whose limb is at `diskRadius` of its width, north up, west right.
 */
export interface SunImageRequest {
  readonly key: string;
  readonly map: ImagePair;
  readonly disc: ImagePair;
  /** Multiplies the images' colours: a warm white for the grey visible-light ones. */
  readonly tint: readonly [number, number, number];
  readonly diskRadius: number;
  /** How much the Sun darkens toward the limb as the camera sees it (u in 1 − u(1 − μ)). */
  readonly limbDarkening: number;
}

/** Loads an image as a texture. */
type LoadTexture = (url: string) => Promise<Texture>;

const loadWithThree: LoadTexture = (url) => loadPicture(url);

/** The Sun's images, loaded with `load` (three's loader in the page; a fake in tests). */
export function sunImageLayerWith(load: LoadTexture): LayerFactory<SunImageRequest | null> {
  return (host: LayerHost) => {
    // Maps and frames already loaded, by URL, and the channel asked for last.
    const textures = new Map<string, Texture>();
    let wanted: SunImageRequest | null = null;
    const data = host.container.dataset;

    function texture(url: string, wraps = false): Promise<Texture> {
      const cached = textures.get(url);
      if (cached !== undefined) return Promise.resolve(cached);
      return load(url).then((loaded) => {
        loaded.colorSpace = SRGBColorSpace;
        // A map's left and right edges meet on the far side.
        if (wraps) loaded.wrapS = RepeatWrapping;
        loaded.anisotropy = host.maxAnisotropy;
        textures.set(url, loaded);
        return loaded;
      });
    }

    function show(
      image: SunImageRequest,
      size: keyof ImagePair,
      [surface, disc]: readonly [Texture, Texture],
    ): void {
      // A later request (another channel) wins over a slow one.
      if (wanted !== image) return;
      host.showSunImage({
        surface,
        disc,
        tint: image.tint,
        diskRadius: image.diskRadius,
        limbDarkening: image.limbDarkening,
      });
      data['sunImage'] = size;
      data['sunLayer'] = image.key;
    }

    return {
      update(image) {
        wanted = image;
        if (image === null) {
          host.showSunImage(null);
          data['sunImage'] = 'none';
          return;
        }
        const both = (size: keyof ImagePair): Promise<[Texture, Texture]> =>
          Promise.all([texture(image.map[size], true), texture(image.disc[size])]);
        // Shown before: at once, large, without waiting a turn.
        const surface = textures.get(image.map.large);
        const disc = textures.get(image.disc.large);
        if (surface !== undefined && disc !== undefined) {
          show(image, 'large', [surface, disc]);
          return;
        }
        both('small')
          .then((small) => {
            show(image, 'small', small);
            return both('large');
          })
          .then((large) => {
            show(image, 'large', large);
          })
          .catch(() => {
            if (wanted === image) data['sunImage'] = 'error';
          });
      },
      dispose() {
        for (const loaded of textures.values()) loaded.dispose();
      },
    };
  };
}

/** The Sun's images, loaded by three in the page. */
export const sunImageLayer = sunImageLayerWith(loadWithThree);
