/**
 * Each telescope as a passage (#851): found by its name and by what it is known for ("Keck",
 * "radio telescope", "X-ray"), anchored to the view that shows it: the Telescopes layer on, over
 * its site in its first light's year, or framed for its orbit while it flew.
 *
 * Pure: no DOM.
 */

import { endYear, yearOf, type Telescope, type Telescopes } from '../data/telescopes';
import { PRESENT_YEAR } from '../time/present';
import type { Anchor, Passage } from './passages';

const SEES: Readonly<Record<Telescope['bands'][number], string>> = {
  radio: 'radio waves',
  microwave: 'microwaves',
  infrared: 'infrared',
  optical: 'visible light',
  ultraviolet: 'ultraviolet',
  'x-ray': 'X-rays',
  gamma: 'gamma rays',
};

/** Where the camera looks for a space telescope, by its orbit. */
const ORBIT_VIEWS: Readonly<Record<Extract<Telescope, { kind: 'space' }>['orbit'], string>> = {
  'low Earth': 'focus=earth&cam=20.0000,0.0000,8.00',
  'high Earth': 'focus=earth&cam=20.0000,0.0000,45.00',
  L2: 'focus=earth&cam=20.0000,0.0000,600.00',
  'around the Sun': 'focus=sun&cam=60.0000,-90.0000,300.00',
};

/** Its years in words: "1963–2020", "since 1990", "being built since 2014". */
function years(telescope: Telescope): string {
  const from = yearOf(telescope.from);
  const end = endYear(telescope);
  if (typeof telescope.until === 'object') return `being built since ${String(from)}`;
  return end === null ? `since ${String(from)}` : `${String(from)}–${String(end)}`;
}

/** The year its view opens at: a year after launch while it still flew, else its first. */
function shownYear(telescope: Telescope): number {
  const from = yearOf(telescope.from);
  const end = endYear(telescope);
  return telescope.kind === 'space' && (end === null || from + 1 < end) ? from + 1 : from;
}

function anchorOf(telescope: Telescope): Anchor {
  const year = shownYear(telescope);
  const when = `t=${String(year)}-06-01T12:00Z`;
  const until = endYear(telescope) ?? PRESENT_YEAR;
  if (telescope.kind === 'ground') {
    const { latitude, longitude } = telescope.site;
    return {
      body: 'earth',
      at: [latitude, longitude],
      when: [yearOf(telescope.from), until],
      label: telescope.name,
      view: `layers=telescopes&${when}&cam=${latitude.toFixed(4)},${longitude.toFixed(4)},2.40`,
    };
  }
  return {
    body: telescope.orbit === 'around the Sun' ? 'sun' : 'earth',
    when: [yearOf(telescope.from), until],
    label: telescope.name,
    view: `layers=telescopes&${when}&${ORBIT_VIEWS[telescope.orbit]}`,
  };
}

/** Every telescope in the record, as a passage. */
export function telescopePassages(record: Telescopes): Passage[] {
  return record.telescopes.map((telescope) => {
    const where =
      telescope.kind === 'ground'
        ? `A telescope on Earth, at ${telescope.site.name}.`
        : `A telescope in space, in ${telescope.orbit === 'L2' ? 'orbit about L2' : `${telescope.orbit} orbit`}.`;
    const sees = telescope.bands.map((band) => SEES[band]).join(', ');
    return {
      id: `telescope:${telescope.id}`,
      kind: 'telescope',
      title: `${telescope.name}, ${years(telescope)}`,
      text: [
        `${where} It sees ${sees}. ${telescope.why}`,
        ...telescope.results.map((result) => `${result}.`),
        `Operated by ${telescope.operators.join('; ')}.`,
      ].join(' '),
      sources: [...telescope.sources],
      anchors: [anchorOf(telescope)],
    };
  });
}
