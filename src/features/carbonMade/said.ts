/**
 * What the Layers panel says of where carbon-14 is made (#269): the field and Sun it is drawn
 * for, and how the field of the moment shown compares with today's. Pure.
 */

import { THEN_ID, THEN_UNKNOWN, type CarbonMade } from './carbonMadeCard';

/** The note for what is drawn: `deep` in deep time, where a field picked is not the moment's. */
export function carbonMadeNote(made: CarbonMade, deep: boolean): string {
  const sun = made.sun.label.toLowerCase();
  if (made.field.id !== THEN_ID) {
    return deep
      ? `Drawn for the field picked (${made.field.label.toLowerCase()}), not that of the moment shown.`
      : `${made.field.label} field, ${sun}: most is made over the poles.`;
  }
  if (made.field === THEN_UNKNOWN) {
    return `The field at the moment shown is not known yet; today’s is drawn, ${sun}.`;
  }
  const strength = made.field.dipole.toFixed(1);
  return made.field.dipole < 4
    ? `The field at the moment shown is weak, ${strength} × 10²² A m² (GGF100k; today’s is 7.8): more is made, and nearer the equator. Other models put this low far lower (Korte et al. 2019).`
    : `The field at the moment shown, ${strength} × 10²² A m² (GGF100k), ${sun}: most is made over the poles.`;
}
