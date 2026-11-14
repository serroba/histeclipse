import { Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';

import { bitmapTexture, loadPicture, type PictureLoading } from './pictureTexture';

/** A stand-in bitmap: close() is all a texture asks of it. */
function fakeBitmap(close = vi.fn()): ImageBitmap {
  return { width: 2, height: 1, close };
}

function loading(flips: boolean) {
  const made = fakeBitmap();
  const fromImage = new Texture();
  const bitmap = vi.fn<(url: string) => Promise<ImageBitmap>>(() => Promise.resolve(made));
  const image = vi.fn<(url: string) => Promise<Texture>>(() => Promise.resolve(fromImage));
  const how: PictureLoading = { flips: () => Promise.resolve(flips), bitmap, image };
  return { how, made, fromImage, bitmap, image };
}

describe('loadPicture', () => {
  it('uses a bitmap, already the right way up, where the browser can flip one', async () => {
    const { how, made, bitmap, image } = loading(true);
    const texture = await loadPicture('maps/earth.jpg', how);
    expect(bitmap).toHaveBeenCalledWith('maps/earth.jpg');
    expect(image).not.toHaveBeenCalled();
    expect(texture.image).toBe(made);
    expect(texture.flipY).toBe(false);
  });

  it('falls back to three’s loader where bitmaps cannot be flipped', async () => {
    const { how, fromImage, bitmap } = loading(false);
    const texture = await loadPicture('maps/earth.jpg', how);
    expect(texture).toBe(fromImage);
    expect(bitmap).not.toHaveBeenCalled();
  });
});

describe('bitmapTexture', () => {
  it('lets the bitmap go when the texture is disposed', () => {
    const close = vi.fn();
    const texture = bitmapTexture(fakeBitmap(close));
    expect(texture.version).toBeGreaterThan(0);
    expect(close).not.toHaveBeenCalled();
    texture.dispose();
    expect(close).toHaveBeenCalledOnce();
  });
});
