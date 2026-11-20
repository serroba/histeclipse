import { layer } from './layer';
import { sealevel } from './sealevel';

/** The Atlantic overturning: measured since 2004, and reconstructions that disagree (#925). */
export const amoc = layer({
  id: 'amoc',
  label: 'Atlantic overturning (AMOC)',
  summary: 'The Atlantic’s great overturning current, and whether it is slowing.',
  about:
    'The Atlantic overturning circulation, measured at 26.5°N since 2004 (RAPID), beside the reconstructions that disagree on whether it has already weakened (Caesar, Rahmstorf, Thornalley, Terhaar), each on its own scale; on the globe, the line the array measures across.',
  spans: ['years'],
  reach:
    'Measured monthly from April 2004 to March 2024; reconstructed back to 400 CE (Thornalley), 900 (Rahmstorf), 1871 (Caesar) and 1963 (Terhaar).',
  covers: { years: [400, 2024] },
  icon: sealevel.icon,
  why: 'amoc',
});
