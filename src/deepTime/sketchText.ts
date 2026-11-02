/** Wording for the sketched surface: what is drawn, on whose say-so, and what is invented. */

import { formatRange } from './milestoneText';
import {
  crustShare,
  EMERGENCE_MA,
  IMPACTS,
  LAND_CHOICES,
  OLDEST_WATER_ZIRCON_MA,
  type Sketch,
  type SketchChoices,
  SNOWBALL_CHOICES,
} from './sketch';

function percent(share: number): string {
  return `${(share * 100).toFixed(share < 0.1 ? 1 : 0)}%`;
}

/** One short line for what is sketched: "Sketch, not a map: 18% land, its shapes invented". */
export function sketchHeadline(sketch: Sketch): string {
  if (sketch.kind === 'magma') return 'Sketch, not a map: a molten surface.';
  const parts: string[] = [];
  if (sketch.questions.includes('land')) {
    parts.push(`${percent(sketch.land)} of the surface land, its shapes and places invented`);
  }
  if (sketch.episode !== null) parts.push(`${sketch.episode.name} snowball`);
  return `Sketch, not a map: ${parts.join(' · ')}.`;
}

/** What the globe shows at this moment, a sentence or two per question it answers. */
export function sketchLines(sketch: Sketch, choices: SketchChoices, ma: number): readonly string[] {
  if (sketch.kind === 'magma') {
    const impact = IMPACTS[choices.impact];
    const lines = [
      `Molten: the surface until about 1.5 million years after the Moon-forming impact, when steam condensed into an ocean (Lebrun et al. 2013). Impact ${formatRange(impact.ma, impact.ma)} (${impact.source}). Before it, the proto-Earth is drawn molten too, though its surface is not known.`,
    ];
    if (impact.ma < OLDEST_WATER_ZIRCON_MA) {
      lines.push(
        `This impact comes after the ${OLDEST_WATER_ZIRCON_MA.toLocaleString('en')}-million-year-old zircon that already shows liquid water (Wilde et al. 2001): the camps disagree on what the dates measure.`,
      );
    }
    return lines;
  }
  const lines: string[] = [];
  if (sketch.questions.includes('impact')) {
    const impact = IMPACTS[choices.impact];
    lines.push(
      `Past the Moon-forming impact as ${impact.source} dates it, ${formatRange(impact.ma, impact.ma)}: an ocean has formed. Other camps date the impact later.`,
    );
  }
  if (sketch.questions.includes('land')) {
    const choice = LAND_CHOICES[choices.land];
    const flooded = choices.land === 'flooded' && ma > EMERGENCE_MA;
    lines.push(
      flooded
        ? `A sketch, not a map: land’s shapes and places are invented. ${percent(sketch.land)} of the surface is drawn as land, the crust above the sea in ${choice.source}.`
        : `A sketch, not a map: land’s shapes and places are invented. ${percent(sketch.land)} of the surface is drawn as land: ${percent(crustShare(choices.land, ma))} of today’s crust (${choice.source}), as if it stood as high above the sea as today’s.`,
      choice.note,
    );
  }
  if (sketch.episode !== null) {
    const { name, young, old, source } = sketch.episode;
    const choice = SNOWBALL_CHOICES[choices.snowball];
    lines.push(
      `${name} glaciation, ${formatRange(young, old)} (${source}). ${choice.note} (${choice.source})`,
    );
  }
  return lines;
}
