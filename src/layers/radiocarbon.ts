import { layer } from './layer';

/** The years: carbon-14 in the air (IntCal20, SHCal20), why a radiocarbon date is a range. */
export const radiocarbon = layer({
  id: 'radiocarbon',
  label: 'Carbon-14 in the air',
  summary: 'How much carbon-14 the air held, year by year.',
  about:
    'How much radiocarbon the air held each year, under the years’ slider: its sudden spikes and its plateaus, and why a radiocarbon date is a range.',
  spans: ['years'],
  reach: 'The calibration curves reach back 55,000 years, to 1950.',
  covers: { years: [-53049, 1950] },
  // A decay curve over axes: half gone, then half again.
  icon: ['M4 4v16h16', 'M6 6c2 6 5 9 9 10.5s4 1.5 5 1.5', 'M10 13.6h.01'],
  why: 'radiocarbon',
});
