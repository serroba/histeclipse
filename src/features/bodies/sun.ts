/**
 * The Sun close up (#449): SDO's images, loaded the first time someone looks at it, and the
 * switch between them.
 */

import { loadSunImages, type SunImages } from '../../data/sunImages';
import type { Globe } from '../../globe/scene';
import type { ViewState } from '../../state/viewState';
import { createSunSwitch } from '../../ui/sunSwitch';
import { errorMessage } from '../../util/errors';
import type { PartContext } from '../part';

export interface SunCloseUp {
  /** Which of its images shows. */
  readonly switch: HTMLElement;
  readonly show: (state: ViewState) => void;
}

export function createSunCloseUp(
  context: PartContext & { readonly globe: Pick<Globe, 'setSunImage'> },
): SunCloseUp {
  const { base, fetchJson, store, globe } = context;
  const sunSwitch = createSunSwitch(
    (sunLayer) => {
      store.set((state) => ({ ...state, sunLayer }));
    },
    context.why('sun', 'The Sun close up'),
  );
  // SDO's images of the Sun load the first time someone looks at it close up.
  let sunImages: SunImages | null = null;
  let sunImagesLoading = false;
  function showSun(state: ViewState): void {
    const close = state.mode === 'globe' && state.focus === 'sun';
    sunSwitch.render(state.sunLayer, close);
    if (!close) {
      globe.setSunImage(null);
      return;
    }
    if (sunImages === null) {
      if (sunImagesLoading) return;
      sunImagesLoading = true;
      loadSunImages(`${base}data/sun-images.json`, fetchJson).then(
        (images) => {
          sunImages = images;
          sunSwitch.setLayers(images.layers, images.credit);
          showSun(store.get());
        },
        (error: unknown) => {
          sunImagesLoading = false;
          context.notify(`Could not load the images of the Sun: ${errorMessage(error)}`);
        },
      );
      return;
    }
    const image = sunImages.layers.find(({ key }) => key === state.sunLayer);
    if (image === undefined) return;
    globe.setSunImage({
      key: image.key,
      map: { small: `${base}${image.map['512']}`, large: `${base}${image.map['4096']}` },
      disc: { small: `${base}${image.disc['512']}`, large: `${base}${image.disc['2048']}` },
      // Visible light comes as grey; the Sun's own light is a warm white.
      tint: image.key === 'visible' ? [1, 0.93, 0.8] : [1, 1, 1],
      diskRadius: sunImages.diskRadius,
      // The map is the surface seen face-on; in visible light it darkens toward the limb, as
      // the Sun does seen by eye.
      limbDarkening: image.key === 'visible' ? 0.6 : 0,
    });
  }

  return { switch: sunSwitch.root, show: showSun };
}
