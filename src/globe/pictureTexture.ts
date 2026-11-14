/**
 * Big maps as textures without stalling the page (#668). Handed an <img>, WebGL decodes it,
 * flips it and converts it on the main thread as it uploads: 230–380 ms for the 4096 and 8192
 * maps of Earth. An ImageBitmap is decoded and flipped off it first, so only the copy is left.
 * Where createImageBitmap cannot flip (Safari before 17 ignores the option), three's loader as
 * before.
 */

import { ImageBitmapLoader, Texture, TextureLoader } from 'three';

/** How pictures are fetched: the browser's, or fakes in tests. */
export interface PictureLoading {
  /** Whether bitmaps can be made upside down, as WebGL's textures expect. */
  flips(): Promise<boolean>;
  /** The picture at `url`, decoded and flipped. */
  bitmap(url: string): Promise<ImageBitmap>;
  /** The picture at `url` as three loads it, an <img>. */
  image(url: string): Promise<Texture>;
}

/** A texture of a bitmap already the right way up; the bitmap is let go with the texture. */
export function bitmapTexture(bitmap: ImageBitmap): Texture {
  const texture = new Texture(bitmap);
  texture.flipY = false;
  texture.needsUpdate = true;
  texture.addEventListener('dispose', () => {
    bitmap.close();
  });
  return texture;
}

/** The picture at `url` as a texture, decoded off the main thread where the browser can. */
export async function loadPicture(url: string, how: PictureLoading = BROWSER): Promise<Texture> {
  return (await how.flips()) ? bitmapTexture(await how.bitmap(url)) : how.image(url);
}

let flipping: Promise<boolean> | null = null;
/** Draw red over blue, flip it, and see which comes out on top. Asked once. */
function bitmapsFlip(): Promise<boolean> {
  flipping ??= (async () => {
    try {
      const source = new OffscreenCanvas(1, 2);
      const paint = source.getContext('2d');
      const check = new OffscreenCanvas(1, 2).getContext('2d', { willReadFrequently: true });
      if (paint === null || check === null) return false;
      paint.fillStyle = '#f00';
      paint.fillRect(0, 0, 1, 1);
      paint.fillStyle = '#00f';
      paint.fillRect(0, 1, 1, 1);
      check.drawImage(await createImageBitmap(source, { imageOrientation: 'flipY' }), 0, 0);
      const [red = 0, , blue = 0] = check.getImageData(0, 0, 1, 1).data;
      return blue > red;
    } catch {
      return false;
    }
  })();
  return flipping;
}

const BROWSER: PictureLoading = {
  flips: bitmapsFlip,
  bitmap: (url) =>
    new ImageBitmapLoader()
      .setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none' })
      .loadAsync(url),
  image: (url) => new TextureLoader().loadAsync(url),
};
