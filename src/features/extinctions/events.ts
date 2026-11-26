/**
 * The great extinctions (#1190): when each was, what it took, and what the studies say caused
 * it, each claim with its sources. The usual list, "the Big Five" (Raup & Sepkoski 1982), is
 * itself argued, and each card says so; the end-Guadalupian, put forward as a sixth (Rampino &
 * Shen 2019), is shown beside them as argued.
 *
 * Pure.
 */

import { MILESTONES } from '../../deepTime/milestones';
import { SOURCES, type SourceId } from '../../sources/registry';

/** A claim about an extinction, and whose studies make it. */
export interface Claim {
  readonly text: string;
  readonly sources: readonly SourceId[];
}

export interface Extinction {
  /** Its milestone's id where it has one (`end-permian-extinction`). */
  readonly id: string;
  readonly title: string;
  /** What it is also called, where it has a common name: "the Great Dying" (#1210). */
  readonly known?: string;
  /** When it is marked and play eases near it, Ma. */
  readonly ma: number;
  /** Whether it is one of the usual five or put forward beside them. */
  readonly counted: 'five' | 'argued';
  readonly lost: Claim;
  readonly causes: Claim;
}

/**
 * What a record site shows, where its card says more than that it is dated there (#1232): the
 * sections beyond each boundary's reference, the end-Permian's on land among them.
 */
export const SITE_NOTES: Readonly<Record<string, Claim>> = {
  wangjiawan: {
    text: 'Where the Hirnantian, the Ordovician’s last stage, is defined to begin: at the first graptolite Normalograptus extraordinarius, as the ice sheet grew and the first pulse struck.',
    sources: ['chen2006'],
  },
  lootsberg: {
    text: 'Rivers and floodplains of the Karoo, where the change of animals long held to mark the extinction on land is dated more than 300,000 years before the sea’s.',
    sources: ['gastaldo2020'],
  },
  'frazer-beach': {
    text: 'Coal swamps of the southern high latitudes, where the Glossopteris forests collapsed before 252.3 million years ago, some 370,000 years before the sea’s extinction.',
    sources: ['fielding2019'],
  },
  'st-audries-bay': {
    text: 'Cliffs where losses in the sea and the change of land plants come together with one sharp drop in carbon isotopes: on land and at sea, the extinction was at the same time.',
    sources: ['hesselbo2002'],
  },
  gubbio: {
    text: 'The limestones of the Bottaccione Gorge, whose boundary clay was found rich in iridium, rare in Earth’s crust and common in meteorites: the first trace of an impact.',
    sources: ['alvarez1980'],
  },
};

/** What every card says of the list itself. */
export const ABOUT_THE_LIST: Claim = {
  text: 'The usual “Big Five” come from Raup & Sepkoski (1982), who found the Devonian’s stands out but not significantly. Bambach (2006) finds only three stand apart from the rest; Rampino & Shen (2019) add the end-Guadalupian as a sixth.',
  sources: ['raupSepkoski1982', 'bambach2006', 'rampinoShen2019'],
};

export const EXTINCTIONS: readonly Extinction[] = [
  {
    id: 'end-ordovician-extinction',
    title: 'End-Ordovician mass extinction',
    ma: 444,
    counted: 'five',
    lost: {
      text: 'One of the four marine extinctions that stand apart in the fossil record, in two pulses.',
      sources: ['raupSepkoski1982', 'harper2014'],
    },
    causes: {
      text: 'An ice age over Gondwana, then at the South Pole: the first pulse came as the ice grew and the seas cooled and fell, the second as it melted and oxygen-poor water spread. Not one cause but several together.',
      sources: ['finnegan2011', 'harper2014'],
    },
  },
  {
    id: 'late-devonian-extinction',
    title: 'Late Devonian extinction',
    ma: 372.2,
    counted: 'five',
    lost: {
      text: 'Reefs and the life of warm shallow seas were hit hardest.',
      sources: ['algeoScheckler1998', 'joachimskiBuggisch2002'],
    },
    causes: {
      text: 'Argued. Pulses of oxygen-poor seas, the Kellwasser black shales (Bond & Wignall); tropical seas cooling by 5–7 °C (Joachimski & Buggisch); the new forests’ soils feeding the seas with nutrients (Algeo & Scheckler); the Viluy Traps, erupting in Siberia near the time (Ricci et al.).',
      sources: ['bondWignall2008', 'joachimskiBuggisch2002', 'algeoScheckler1998', 'ricci2013'],
    },
  },
  {
    id: 'end-guadalupian-extinction',
    title: 'End-Guadalupian extinction',
    ma: 259.8,
    counted: 'argued',
    lost: {
      text: 'Put forward as a sixth great extinction, by the genera lost and its effect on ecosystems.',
      sources: ['rampinoShen2019'],
    },
    causes: {
      text: 'In southwest China the Emeishan lavas lie among the limestones that record it: the eruptions began as the extinction did.',
      sources: ['wignall2009'],
    },
  },
  {
    id: 'end-permian-extinction',
    title: 'End-Permian mass extinction',
    known: 'the Great Dying',
    ma: 251.9,
    counted: 'five',
    lost: {
      text: 'The most severe known, in at most 61,000 ± 48,000 years: more than 90% of the sea’s species and 75% of the land’s, as usually quoted (Burgess & Bowring); some 81% of the sea’s once the extinction already under way before it is counted apart (Stanley).',
      sources: ['burgessBowring2015', 'stanley2016', 'burgess2014'],
    },
    causes: {
      text: 'The Siberian Traps, erupting before, during and after it. As it began, their sills spread through coal and evaporites, and the heat released greenhouse gases and halocarbons through hundreds of vents.',
      sources: ['burgessBowring2015', 'burgess2017', 'svensen2009'],
    },
  },
  {
    id: 'end-triassic-extinction',
    title: 'End-Triassic mass extinction',
    ma: 201.5,
    counted: 'five',
    lost: {
      text: 'One of the four marine extinctions that stand apart in the fossil record.',
      sources: ['raupSepkoski1982'],
    },
    causes: {
      text: 'The Central Atlantic Magmatic Province: lavas and sills over more than 7 million km² as first mapped, more than 10 million as known now, as Pangaea broke up, dated to the extinction. CO₂ about doubled after each of its first pulses, to some 4,400 ppm.',
      sources: ['marzoli1999', 'lindstrom2021', 'blackburn2013', 'schaller2011'],
    },
  },
  {
    id: 'k-pg-extinction',
    title: 'End-Cretaceous extinction',
    known: 'the end of the dinosaurs',
    ma: 66,
    counted: 'five',
    lost: {
      text: 'The non-avian dinosaurs, the ammonites and most species of the time.',
      sources: ['schulte2010'],
    },
    causes: {
      text: 'The Chicxulub impact, widely held the main cause (Schulte et al.; Hull et al.). The Deccan Traps were erupting in India too: mostly before the impact (Schoene et al.) or after it (Sprain et al.), and how much that added is argued.',
      sources: ['schulte2010', 'hull2020', 'schoene2019', 'sprain2019'],
    },
  },
];

/** The extinction with `id`, if it is one. */
export function extinctionOf(id: string): Extinction | undefined {
  return EXTINCTIONS.find((each) => each.id === id);
}

/** Its dated estimates, as its milestone gives them. */
export function estimatesOf(extinction: Extinction): readonly string[] {
  const milestone = MILESTONES.find((each) => each.id === extinction.id);
  return (milestone?.estimates ?? []).map(({ label, min, max }) =>
    min === max ? `${label}: ${String(min)} Ma` : `${label}: ${String(max)}–${String(min)} Ma`,
  );
}

/** The sources a claim rests on, as links. */
export function claimLinks(claims: readonly Claim[]): { label: string; href: string }[] {
  const ids = [...new Set(claims.flatMap((claim) => claim.sources))];
  return ids.map((id) => ({ label: SOURCES[id].name, href: SOURCES[id].url }));
}
