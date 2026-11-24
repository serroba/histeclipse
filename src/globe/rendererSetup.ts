/**
 * How the globe's renderer is set up (#1196): see-through, so the page's space gradient shows
 * behind it, at most two device pixels to a CSS pixel, and checking its shaders only where a
 * broken one should say so.
 */

interface Settable {
  setClearColor(color: number, alpha: number): unknown;
  setPixelRatio(ratio: number): void;
  readonly debug: { checkShaderErrors: boolean };
}

/**
 * Set `renderer` up for a screen of `pixelRatio`, checking its shaders if `checkShaders`.
 * Reading each new shader's compile log makes the browser finish compiling it there and then:
 * 50 to 250 ms on a phone the first time a layer draws. The globe spares readers it, and
 * checks in development and in a driven browser (the tests), where a broken shader must say so.
 */
export function setUpRenderer(renderer: Settable, pixelRatio: number, checkShaders: boolean): void {
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(pixelRatio, 2));
  renderer.debug.checkShaderErrors = checkShaders;
}
