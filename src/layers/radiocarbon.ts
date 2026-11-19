import { layer } from './layer';

/** The years: carbon-14 in the air (IntCal20, SHCal20), why a radiocarbon date is a range. */
export const radiocarbon = layer({
  id: 'radiocarbon',
  label: 'Carbon-14 in the air',
  about:
    'How much radiocarbon the air held each year, under the years’ slider: its sudden spikes and its plateaus, and why a radiocarbon date is a range.',
  spans: ['years'],
  reach: 'The calibration curves reach back 55,000 years, to 1950.',
  covers: { years: [-53049, 1950] },
});
