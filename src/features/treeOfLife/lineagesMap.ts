/**
 * Life through time's map of the moment (#358): the elevation map of the 5 million years shown,
 * coloured, with the genera living then where their finds lay, and every site of the picked one
 * faint. Also which genus is under a point of it. Drawn on a 2D canvas.
 */

import { isWithin, sitesAt, type Place } from '../../data/lineages';
import { elementAt } from '../../util/arrays';
import { colourOf, fit, NEAR, type Moment } from './lineagesTree';

/** The elevation maps' step and reach (Ma), as `public/data/paleodem/` holds them. */
const MAP_STEP_MA = 5;
const MAP_REACH_MA = 540;

export interface MomentMap {
  /** Show the elevation map of the step `ma` is in, once it has loaded. */
  load(ma: number): void;
  /** Forget the map shown, for a new group. */
  reset(): void;
  draw(moment: Moment): void;
  /** The living genus at a point of the map, if one is near enough. */
  genusAt(moment: Moment, x: number, y: number): number | undefined;
}

export function createMomentMap(
  canvas: HTMLCanvasElement,
  /** The elevation map's url for a moment (Ma, a multiple of 5 up to 540). */
  floorUrl: (ma: number) => string,
  /** A map has loaded: draw it. */
  loaded: () => void,
): MomentMap {
  /** The maps of each moment, coloured, as they load; and the step shown. */
  const maps = new Map<number, Promise<HTMLCanvasElement>>();
  let image: HTMLCanvasElement | null = null;
  let step = -1;

  function xy(place: Place): readonly [number, number] {
    return [
      ((place.longitude + 180) / 360) * canvas.clientWidth,
      ((90 - place.latitude) / 180) * canvas.clientHeight,
    ];
  }

  return {
    load(ma) {
      const wanted = Math.min(
        MAP_REACH_MA,
        Math.max(0, Math.round(ma / MAP_STEP_MA) * MAP_STEP_MA),
      );
      if (wanted === step) return;
      step = wanted;
      let made = maps.get(wanted);
      if (made === undefined) {
        made = paint(floorUrl(wanted), 720, 360);
        made.catch(() => maps.delete(wanted));
        maps.set(wanted, made);
      }
      made.then(
        (painted) => {
          if (step !== wanted) return;
          image = painted;
          loaded();
        },
        () => {
          // The map stays as it was; the dots still read without it.
        },
      );
    },
    reset() {
      step = -1;
      image = null;
    },
    draw(moment) {
      const context = fit(canvas);
      if (context === null) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      context.fillStyle = '#0a1428';
      context.fillRect(0, 0, width, height);
      if (image !== null) context.drawImage(image, 0, 0, width, height);
      drawSites(context, moment, xy);
    },
    genusAt({ data, at, living }, x, y) {
      let best: number | undefined;
      let nearest = NEAR;
      for (const index of living) {
        const { track } = elementAt(data.lineages.nodes, index);
        for (const site of sitesAt(track, at, data.lineages.stepMa).sites) {
          const [dx, dy] = xy(site);
          const away = Math.hypot(dx - x, dy - y);
          if (away < nearest) {
            nearest = away;
            best = index;
          }
        }
      }
      return best;
    },
  };
}

/** Every site of the picked genus, faint; then where each living genus was found. */
function drawSites(
  context: CanvasRenderingContext2D,
  { data, at, picked, living }: Moment,
  xy: (place: Place) => readonly [number, number],
): void {
  // Every site the picked genus was found at, faint, each where its plate carried it then.
  const node = picked >= 0 ? elementAt(data.lineages.nodes, picked) : null;
  if (node !== null) {
    context.fillStyle = 'rgba(255, 255, 255, 0.45)';
    for (const site of node.track) {
      const [x, y] = xy(site);
      context.beginPath();
      context.arc(x, y, 1.6, 0, 2 * Math.PI);
      context.fill();
    }
  }
  for (const index of living) {
    const { sites, found } = sitesAt(
      elementAt(data.lineages.nodes, index).track,
      at,
      data.lineages.stepMa,
    );
    const dimmed = picked >= 0 && !isWithin(data.lineages, index, picked);
    const colour = dimmed ? 'rgba(70, 85, 115, 0.8)' : colourOf(data, index);
    for (const site of sites) {
      const [x, y] = xy(site);
      context.beginPath();
      context.arc(x, y, index === picked ? 4.5 : found ? 2.4 : 2, 0, 2 * Math.PI);
      // Found in this step: filled. Not found then: a ring where it was last found.
      if (found) {
        context.fillStyle = colour;
        context.fill();
      } else {
        context.lineWidth = 1;
        context.strokeStyle = colour;
        context.stroke();
      }
      if (index === picked) {
        context.lineWidth = 1.5;
        context.strokeStyle = '#ffffff';
        context.stroke();
      }
    }
  }
}

/**
 * The elevation map at `url` as a coloured picture: sea floor in blues, deeper darker; land in
 * greens and browns, higher lighter. Bytes below 128 are sea, as the pipeline packs them.
 */
async function paint(url: string, width: number, height: number): Promise<HTMLCanvasElement> {
  const image = new Image();
  image.src = url;
  await image.decode();
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const context = out.getContext('2d', { willReadFrequently: true });
  if (context === null) return out;
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  const bytes = pixels.data;
  for (let at = 0; at < bytes.length; at += 4) {
    const level = bytes[at] ?? 0;
    if (level < 128) {
      const deep = level / 127;
      bytes[at] = 8 + 14 * deep;
      bytes[at + 1] = 18 + 34 * deep;
      bytes[at + 2] = 40 + 60 * deep;
    } else {
      const high = (level - 128) / 127;
      bytes[at] = 62 + 120 * high;
      bytes[at + 1] = 84 + 80 * high;
      bytes[at + 2] = 52 + 60 * high;
    }
    bytes[at + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  return out;
}
