/**
 * The great extinctions as passages for search (#1210): one each, so a search for the
 * end-Permian, the Great Dying or the Siberian Traps finds that extinction itself and opens it
 * at its moment, the layer on and the globe turned to its places, not the layer's description at
 * the start of its span. Each holds what it took, its causes, what the list of five is, and what
 * its own clock says, phase by phase, with all their sources.
 */

import { siteThen, type ExtinctionSites } from '../../data/extinctions';
import { SOURCES, type SourceId } from '../../sources/registry';
import type { Passage } from '../../text/passages';
import { formatMa } from '../../time/format';
import { ABOUT_THE_LIST, EXTINCTIONS, type Extinction } from './events';
import { ownTimeOf } from './ownTimeEvents';

/** How far out a passage's view opens, Earth radii: a site and its surroundings. */
const DISTANCE = 2.6;

/** The registry's key for a source linked by `url`. */
const BY_URL = new Map(
  (Object.entries(SOURCES) as [SourceId, (typeof SOURCES)[SourceId]][]).map(([id, source]) => [
    source.url,
    id,
  ]),
);

/** An extinction as a passage, its anchors its places at its time. */
function extinctionPassage(data: ExtinctionSites, extinction: Extinction): Passage {
  const { ma } = extinction;
  const phases = ownTimeOf(data, extinction.id, ma)?.phases ?? [];
  const claims = [extinction.lost, extinction.causes, ABOUT_THE_LIST];
  const sources = new Set<string>(claims.flatMap((claim) => claim.sources));
  for (const phase of phases) {
    for (const source of phase.sources) {
      const id = BY_URL.get(source.url);
      if (id !== undefined) sources.add(id);
    }
  }
  const anchors = data.sites.flatMap((site) => {
    const point = site.extinction === extinction.id ? siteThen(data, site, ma) : null;
    if (point === null) return [];
    const lat = point.latitude.toFixed(4);
    const lon = point.longitude.toFixed(4);
    return [
      {
        body: 'earth' as const,
        at: [Number(lat), Number(lon)] as [number, number],
        label: `${site.name}, ${formatMa(ma)}`,
        view: `layers=extinctions&ma=${String(ma)}&scale=all&cam=${lat},${lon},${DISTANCE.toFixed(2)}`,
        // Its card opens there, so watching it in its own time is a tap away (#1233).
        pick: `extinction:${site.id}`,
      },
    ];
  });
  return {
    id: `extinction:${extinction.id}`,
    kind: 'extinction',
    title:
      extinction.known === undefined
        ? extinction.title
        : `${extinction.title}: ${extinction.known}`,
    text: [
      extinction.lost.text,
      extinction.causes.text,
      ABOUT_THE_LIST.text,
      ...phases.map((phase) => `${phase.title}. ${phase.text}`),
    ].join(' '),
    sources: [...sources],
    anchors,
  };
}

/** Every great extinction as a passage, oldest first. */
export function extinctionPassages(data: ExtinctionSites): Passage[] {
  return EXTINCTIONS.map((extinction) => extinctionPassage(data, extinction));
}
