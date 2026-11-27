/**
 * The sea's carbon through the end-Permian extinction (#1229): the carbon isotopes of carbonate
 * rock, δ¹³C, from ten sections around the Tethys Ocean, as compiled with their ages by Wu et
 * al. (2021, Nature Communications) and published by Cui et al. (2021, PNAS, Dataset S02).
 *
 * Each section is the work of its own authors: Meishan, Burgess, Bowring & Shen (2014); Nhi
 * Tao, Algeo et al. (2007); Yangou, Song et al. (2012); Bálvány North, Schobben et al. (2017);
 * Zal and Kuh-e-Ali Bashi, Schobben et al. (2014); Shahreza and Abadeh, Korte et al. (2010);
 * Wadi Shahha, Clarkson et al. (2013); Wenbudangsang, Ji et al. (2018, Acta Geologica Sinica,
 * no DOI found). The ages are Wu et al.'s: each section matched to Meishan's isotope shift,
 * dated by its ash beds (Burgess et al. 2014).
 *
 * Meishan, where the clock's zero is set, is drawn as its own series; the other nine as one.
 *
 * Pure.
 */

import type { ProxyChart } from '../ownTime';
import SECTIONS from './permianCarbonIsotopes.json' with { type: 'json' };

const KYR = 1000 * 365.25 * 86_400;
/** The clock's zero: bed 25 at Meishan, the extinction's start. */
const ZERO = 251.941;

/** One section's measurements: its age, Ma, and δ¹³C, ‰ VPDB, oldest first. */
interface Section {
  readonly section: string;
  readonly region: string;
  readonly points: readonly (readonly number[])[];
}

const PERMIAN_SECTIONS: readonly Section[] = SECTIONS;

export const PERMIAN_CARBON_ISOTOPES: ProxyChart = {
  name: 'Carbon isotopes',
  title: 'Carbon isotopes of the sea’s carbonate, δ¹³C, ‰',
  low: -5,
  high: 5,
  series: ['Meishan, China', 'Nine other Tethys sections'],
  readings: PERMIAN_SECTIONS.flatMap(({ section, points }) =>
    points.map(([ma = ZERO, value = 0]) => ({
      seconds: (ZERO - ma) * 1000 * KYR,
      value,
      series: section === 'Meishan' ? 0 : 1,
    })),
  ),
  says: 'The share of heavy carbon in the sea’s limestone, measured at ten sections around the Tethys Ocean: at Meishan it falls from about +3‰ to below −1‰, at its lowest −4‰, over the 30,000 years to the extinction’s start. Light carbon flooded the sea and air: mostly volcanic gas, as Cui et al. (2021) work it out, or with carbon from organic rock and coal the Siberian Traps heated, as Wu et al. (2021) argue. Compiled with ages by Wu et al. (2021) and published by Cui et al. (2021); each section by its own authors (Burgess et al. 2014; Algeo et al. 2007; Song et al. 2012; Schobben et al. 2014, 2017; Korte et al. 2010; Clarkson et al. 2013; Ji et al. 2018). Each section is dated by matching its shift to Meishan’s, whose ash beds are dated.',
};
