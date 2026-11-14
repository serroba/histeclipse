/**
 * Where craft came down, on the body in view (#716): each lander with a known site marked and
 * named on the surface, from the day it landed, turning with the body; a tap opens its card.
 * A craft at the body in view is not drawn as a dot at its centre: close up, its site is it.
 * A layer on the globe's host (#379): `globe.addLayer(landingSites)`.
 */

import { Vector3 } from 'three';

import { gcatJd, type Craft } from '../../data/spacecraft';
import { isNamedBody, type NamedBody } from '../../data/planetNames';
import { geoToVector } from '../../globe/geo';
import type { LayerFactory } from '../../globe/layerHost';
import { planetRadius } from '../../globe/planetLook';
import { MOON_RADIUS_EARTH_RADII } from '../../globe/spaceFrame';
import './landingSites.css';

/** GCAT's names for the worlds, as the site's bodies. */
const BODY_OF: Readonly<Record<string, string>> = {
  Luna: 'moon',
  Mercury: 'mercury',
  Venus: 'venus',
  Mars: 'mars',
  Jupiter: 'jupiter',
  Saturn: 'saturn',
};

/** The site's body a GCAT world is, or null. */
export function bodyOfWorld(world: string): string | null {
  return BODY_OF[world] ?? null;
}

export interface LandingSite {
  readonly id: string;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
}

/** The landers on `body` by `jdUT`, with a known site; those with no date count from launch. */
export function landedOn(craft: readonly Craft[], body: string, jdUT: number): LandingSite[] {
  const sites = craft.flatMap((each) => {
    const landing = each.landing;
    // What a lander carried down (Apollo's science packages) is at its site: marked once.
    if (each.part || landing === undefined || landing.lat === null || landing.lon === null) {
      return [];
    }
    if (bodyOfWorld(landing.world) !== body) return [];
    if (gcatJd(landing.date ?? each.launch) > jdUT) return [];
    // GCAT writes some longitudes from 0 to 360°, or west past −180°.
    const longitude =
      Math.abs(landing.lon) <= 180
        ? landing.lon
        : ((((landing.lon + 180) % 360) + 360) % 360) - 180;
    const name =
      each.mission === undefined || each.mission === each.name
        ? each.name
        : `${each.mission}: ${each.name}`;
    return [
      {
        id: each.id,
        name,
        latitude: landing.lat,
        longitude,
        jd: gcatJd(landing.date ?? each.launch),
      },
    ];
  });
  // The latest first: where sites crowd, the one just landed is named (#716).
  return sites
    .sort((a, b) => b.jd - a.jd)
    .map(({ id, name, latitude, longitude }) => ({ id, name, latitude, longitude }));
}

/** The landers to mark, on a body; null marks none. */
export interface SitesShown {
  readonly body: string;
  readonly sites: readonly LandingSite[];
}

/** Pixels a site's name keeps from another's. */
const APART = 6;
/** How far the body must fill the view, its radius in pixels, before sites are marked. */
const NEAR_PIXELS = 60;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Whether a name's box keeps clear of those already placed. */
function clear(box: Box, placed: readonly Box[]): boolean {
  return placed.every(
    (other) =>
      box.x > other.x + other.w + APART ||
      other.x > box.x + box.w + APART ||
      box.y > other.y + other.h ||
      other.y > box.y + box.h,
  );
}

/**
 * A mark for each site in `layer`, its place on the body in the body's own axes and its width:
 * every one measured while unseen, in one layout, then hidden until placed.
 */
function siteMarks(layer: HTMLElement, sites: readonly LandingSite[], radius: number) {
  const elements = sites.map(({ id, name }) => {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'landing-site';
    element.dataset['pick'] = `craft:${id}`;
    element.textContent = name;
    element.style.visibility = 'hidden';
    return element;
  });
  layer.replaceChildren(...elements);
  const widths = elements.map((element) => element.offsetWidth);
  return sites.map(({ latitude, longitude }, index) => {
    const element = elements[index] ?? document.createElement('button');
    element.hidden = true;
    element.style.visibility = '';
    return {
      element,
      width: widths[index] ?? 0,
      position: new Vector3(...geoToVector({ latitude, longitude }, radius)),
    };
  });
}

export const landingSites: LayerFactory<SitesShown | null> = (host) => {
  const layer = document.createElement('div');
  layer.className = 'landing-sites';
  layer.dataset['testid'] = 'landing-sites';
  host.container.append(layer);
  host.pickable(layer);
  let shown: {
    readonly body: NamedBody;
    readonly marks: readonly { element: HTMLElement; width: number; position: Vector3 }[];
  } | null = null;

  const outward = new Vector3();
  const toEye = new Vector3();
  const projected = new Vector3();
  host.afterRender(() => {
    if (shown === null) return;
    const { camera, container } = host;
    const { position, rotation, radius, shown: drawn } = host.bodyFrame(shown.body);
    const width = container.clientWidth;
    const height = container.clientHeight;
    const distance = camera.position.distanceTo(position);
    const pixels = (radius / distance) * (height / 2 / Math.tan((camera.fov * Math.PI) / 360));
    const near = drawn && host.focus() === shown.body && pixels > NEAR_PIXELS;
    const placed: Box[] = [];
    let count = 0;
    for (const { element, width: wide, position: at } of shown.marks) {
      outward.copy(at).applyQuaternion(rotation);
      projected.copy(outward).add(position);
      toEye.copy(camera.position).sub(projected).normalize();
      const facing = outward.normalize().dot(toEye) > 0.2;
      projected.project(camera);
      const x = ((projected.x + 1) / 2) * width;
      const y = ((1 - projected.y) / 2) * height;
      const box = { x: x - 4, y: y - 8, w: wide + 8, h: 16 };
      const visible =
        near &&
        facing &&
        projected.z < 1 &&
        x >= 0 &&
        x <= width &&
        y >= 0 &&
        y <= height &&
        clear(box, placed);
      element.hidden = !visible;
      if (!visible) continue;
      placed.push(box);
      count += 1;
      element.style.transform = `translate(${String(x)}px, ${String(y)}px) translate(-6px, -50%)`;
    }
    layer.dataset['shown'] = String(count);
  });

  return {
    update(input) {
      const body = input?.body ?? '';
      if (input === null || !isNamedBody(body) || input.sites.length === 0) {
        if (shown !== null) layer.replaceChildren();
        shown = null;
        layer.dataset['marked'] = '0';
        host.requestRender();
        return;
      }
      const key = input.sites.map(({ id }) => id).join(' ');
      if (shown?.body === body && layer.dataset['key'] === key) return;
      layer.dataset['key'] = key;
      const radius = body === 'moon' ? MOON_RADIUS_EARTH_RADII : planetRadius(body);
      const marks = siteMarks(layer, input.sites, radius);
      shown = { body, marks };
      layer.dataset['marked'] = String(marks.length);
      host.requestRender();
    },
  };
};
