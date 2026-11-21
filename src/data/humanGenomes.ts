/**
 * Ancient DNA of Neanderthals, Denisovans and the early modern humans who carry their ancestry
 * (`public/data/humans/genomes.json`, #1047): each individual, or each cave's sediments, with what
 * was read (nuclear genome, mitochondrial, Y chromosome, sediment), how deeply, what it showed,
 * the paper and where the data can be had. Most rows start from the Allen Ancient DNA Resource
 * (CC0); those it lacks (mitochondria only, sediments) come from their papers.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from '../util/fetchJson';
import { HUMAN_SPECIES, kaRange } from './humanClaims';

const words = (most: number) => v.pipe(v.string(), v.minLength(1), v.maxLength(most));
const ka = v.pipe(v.number(), v.minValue(0));
const Source = v.strictObject({
  citation: words(120),
  doi: v.pipe(v.string(), v.regex(/^10\.\d{4,9}\/\S+$/)),
});

/** What was read: a whole genome deeply or thinly, the mitochondria, the Y, or a cave's floor. */
export const DNA_KINDS = ['nuclear-high', 'nuclear-low', 'mtDNA', 'Y', 'sediment'] as const;
type DnaKind = (typeof DNA_KINDS)[number];

const DNA_NAMES: Readonly<Record<DnaKind, string>> = {
  'nuclear-high': 'high-coverage genome',
  'nuclear-low': 'low-coverage genome',
  mtDNA: 'mitochondrial DNA',
  Y: 'Y chromosome',
  sediment: 'DNA from the cave’s sediments',
};

const GenomesSchema = v.pipe(
  v.strictObject({
    schemaVersion: v.literal(1),
    about: words(800),
    genomes: v.array(
      v.pipe(
        v.strictObject({
          id: v.pipe(v.string(), v.regex(/^[a-z0-9-]+$/)),
          label: words(80),
          species: v.picklist(HUMAN_SPECIES),
          /** The site's find (claims.json), whose card lists it. */
          site: v.pipe(v.string(), v.regex(/^[a-z0-9-]+$/)),
          fromKa: ka,
          toKa: ka,
          data: v.pipe(v.array(v.picklist(DNA_KINDS)), v.minLength(1)),
          coverage: v.nullable(words(40)),
          sex: v.nullable(v.picklist(['female', 'male'])),
          mtHaplo: v.nullable(words(60)),
          yHaplo: v.nullable(words(60)),
          showed: words(320),
          source: Source,
          /** Where the reads can be had: the AADR's archive, ENA or EBI, or the institute's page. */
          repository: v.nullable(v.pipe(v.string(), v.url(), v.startsWith('https://'))),
          /** Other studies of it, each bearing it out or challenging it. */
          evidence: v.optional(
            v.array(
              v.strictObject({
                stance: v.picklist(['supports', 'challenges']),
                kind: v.picklist([
                  'dating',
                  'fossil',
                  'genetic',
                  'archaeological',
                  'environmental',
                ]),
                text: words(260),
                source: Source,
              }),
            ),
          ),
        }),
        v.check((genome) => genome.fromKa >= genome.toKa, 'a date runs from oldest to youngest'),
      ),
    ),
  }),
  v.check(
    (data) => new Set(data.genomes.map((genome) => genome.id)).size === data.genomes.length,
    'each genome once',
  ),
);

export type HumanGenomes = v.InferOutput<typeof GenomesSchema>;
type Genome = HumanGenomes['genomes'][number];

export async function loadHumanGenomes(url: string, fetchJson: Fetch): Promise<HumanGenomes> {
  return getJson(fetchJson, url, GenomesSchema);
}

/** The genomes read at a site, oldest first. */
export function genomesAt(data: HumanGenomes, site: string): readonly Genome[] {
  return data.genomes.filter((genome) => genome.site === site).sort((a, b) => b.fromKa - a.fromKa);
}

/** One genome as a line: what was read, how deeply, whose, and what it showed, with its paper. */
function genomeLine(genome: Genome): string {
  const read = genome.data.map((kind) => DNA_NAMES[kind]).join(', ');
  const details = [
    genome.coverage === null ? null : `${genome.coverage} coverage`,
    genome.sex,
    genome.mtHaplo === null ? null : `mtDNA ${genome.mtHaplo}`,
    genome.yHaplo === null ? null : `Y ${genome.yHaplo}`,
    kaRange(genome.fromKa, genome.toKa),
  ].filter((part) => part !== null);
  return `${read} (${details.join(', ')}). ${genome.showed} (${genome.source.citation})`;
}

/** A site card's rows for its genomes, and their papers and data as links. */
export function genomeRows(
  data: HumanGenomes,
  site: string,
): {
  readonly facts: readonly (readonly [string, string])[];
  readonly links: readonly { readonly label: string; readonly href: string }[];
} {
  const genomes = genomesAt(data, site);
  return {
    facts: [
      ...(genomes.length === 0
        ? []
        : [
            [
              'Ancient DNA',
              `${String(genomes.length)} ${genomes.length === 1 ? 'sample' : 'samples'} read here.`,
            ] as const,
          ]),
      ...genomes.flatMap((genome) => [
        [`DNA: ${genome.label}`, genomeLine(genome)] as const,
        ...(genome.evidence ?? []).map(
          (item) =>
            [
              `${item.stance === 'supports' ? 'Supports' : 'Challenges'} (${genome.label})`,
              `${item.text} (${item.source.citation})`,
            ] as const,
        ),
      ]),
    ],
    links: genomes.flatMap((genome) => [
      { label: genome.source.citation, href: `https://doi.org/${genome.source.doi}` },
      ...(genome.evidence ?? []).map((item) => ({
        label: item.source.citation,
        href: `https://doi.org/${item.source.doi}`,
      })),
      ...(genome.repository === null
        ? []
        : [{ label: `${genome.label}: the data`, href: genome.repository }]),
    ]),
  };
}
