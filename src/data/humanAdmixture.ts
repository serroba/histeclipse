/**
 * Interbreeding (`public/data/humans/admixture.json`, #1047): each episode of mixing that DNA
 * shows among Neanderthals, Denisovans and our species, when (where it can be dated), how much,
 * the competing estimates side by side, the evidence for and against, and the finds whose DNA
 * shows it; and what it left in living people. Inferred from genomes, not seen: every estimate
 * is a model's, and given with its paper.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from '../util/fetchJson';
import { kaRange, SPECIES_NAMES, type HumanSpecies } from './humanClaims';

const words = (most: number) => v.pipe(v.string(), v.minLength(1), v.maxLength(most));
const ka = v.pipe(v.number(), v.minValue(0));
const Source = v.strictObject({
  citation: words(120),
  doi: v.pipe(v.string(), v.regex(/^10\.\d{4,9}\/\S+$/)),
});
const Evidence = v.strictObject({
  stance: v.picklist(['supports', 'challenges']),
  kind: v.picklist(['dating', 'fossil', 'genetic', 'archaeological', 'environmental']),
  text: words(260),
  source: Source,
});
type Evidence = v.InferOutput<typeof Evidence>;
const Who = v.picklist(['neanderthal', 'denisovan', 'sapiens']);
const id = v.pipe(v.string(), v.regex(/^[a-z0-9-]+$/));

const AdmixtureSchema = v.strictObject({
  schemaVersion: v.literal(1),
  about: words(800),
  episodes: v.array(
    v.pipe(
      v.strictObject({
        id,
        title: words(120),
        from: Who,
        into: Who,
        /** The window the estimates span, oldest first; null where no one has dated it. */
        fromKa: v.nullable(ka),
        toKa: v.nullable(ka),
        where: v.nullable(words(200)),
        summary: words(400),
        /** Each paper's estimate, side by side. */
        estimates: v.pipe(
          v.array(v.strictObject({ text: words(260), source: Source })),
          v.minLength(1),
        ),
        evidence: v.array(Evidence),
        /** The people whose DNA shows it. */
        individuals: v.array(words(80)),
        /** Their finds on the map (claims.json). */
        finds: v.array(id),
      }),
      v.check(
        (episode) =>
          (episode.fromKa === null) === (episode.toKa === null) &&
          (episode.fromKa === null || episode.toKa === null || episode.fromKa >= episode.toKa),
        'a window runs from oldest to youngest, or is not given at all',
      ),
    ),
  ),
  traits: v.array(
    v.strictObject({ id, title: words(120), summary: words(320), evidence: v.array(Evidence) }),
  ),
});

export type HumanAdmixture = v.InferOutput<typeof AdmixtureSchema>;
type Episode = HumanAdmixture['episodes'][number];

export async function loadHumanAdmixture(url: string, fetchJson: Fetch): Promise<HumanAdmixture> {
  return getJson(fetchJson, url, AdmixtureSchema);
}

/** The episodes reached at `shownKa`: those dated from their window's start, the undated always. */
export function episodesAt(data: HumanAdmixture, shownKa: number): readonly Episode[] {
  return data.episodes.filter((episode) => episode.fromKa === null || shownKa <= episode.fromKa);
}

const said = (item: Evidence): string => `${item.text} (${item.source.citation})`;
const doiLink = (source: { citation: string; doi: string }) => ({
  label: source.citation,
  href: `https://doi.org/${source.doi}`,
});

/** Each paper once, in the order first named. */
function once(
  links: readonly { label: string; href: string }[],
): { label: string; href: string }[] {
  return links.filter(
    (link, index) => links.findIndex((each) => each.href === link.href) === index,
  );
}

/** An episode's card: who into whom, when, where, the estimates side by side, and the evidence. */
export function episodeCard(
  data: HumanAdmixture,
  episodeId: string,
): {
  readonly title: string;
  readonly facts: readonly (readonly [string, string])[];
  readonly links: readonly { readonly label: string; readonly href: string }[];
  readonly note: string;
  readonly finds: readonly string[];
} | null {
  const episode = data.episodes.find((each) => each.id === episodeId);
  if (episode === undefined) return null;
  const name = (who: HumanSpecies) => SPECIES_NAMES[who];
  return {
    title: episode.title,
    facts: [
      [
        'Who',
        episode.from === episode.into
          ? `${name(episode.from)}, among themselves`
          : `From ${name(episode.from)} into ${name(episode.into)}`,
      ],
      [
        'When',
        episode.fromKa === null || episode.toKa === null
          ? 'Not dated'
          : `${kaRange(episode.fromKa, episode.toKa)}, the span the estimates below cover`,
      ],
      ...(episode.where === null ? [] : [['Where', episode.where] as const]),
      ['What', episode.summary],
      ...episode.estimates.map((estimate) => ['Estimate', estimate.text] as const),
      ...episode.evidence.map(
        (item) =>
          [
            `${item.stance === 'supports' ? 'Supports' : 'Challenges'} (${item.kind})`,
            said(item),
          ] as const,
      ),
      ...(episode.individuals.length === 0
        ? []
        : [['Seen in', episode.individuals.join('; ')] as const]),
    ],
    links: once([
      ...episode.estimates.map((estimate) => doiLink(estimate.source)),
      ...episode.evidence.map((item) => doiLink(item.source)),
    ]),
    note: 'Inferred from DNA, not seen: each estimate is a model’s, given with its paper.',
    finds: episode.finds,
  };
}

/** A trait's card: what living people carry from the mixing, and the studies of it. */
export function traitCard(
  data: HumanAdmixture,
  traitId: string,
): {
  readonly title: string;
  readonly facts: readonly (readonly [string, string])[];
  readonly links: readonly { readonly label: string; readonly href: string }[];
  readonly note: string;
} | null {
  const trait = data.traits.find((each) => each.id === traitId);
  if (trait === undefined) return null;
  return {
    title: trait.title,
    facts: [
      ['What', trait.summary],
      ...trait.evidence.map(
        (item) =>
          [
            `${item.stance === 'supports' ? 'Supports' : 'Challenges'} (${item.kind})`,
            said(item),
          ] as const,
      ),
    ],
    links: once(trait.evidence.map((item) => doiLink(item.source))),
    note: 'What living people carry from the mixing, from studies of their genomes.',
  };
}
