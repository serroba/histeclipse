import { layer } from './layer';

/** How people lived by region (ArchaeoGLOBE): foraging, herding, farming, towns. */
export const ways = layer({
  id: 'ways',
  label: 'Ways of life',
  summary: 'How people lived: foraging, herding, farming, towns.',
  about:
    'How people lived by region, as archaeologists rated it (ArchaeoGLOBE): foraging, herding, farming, towns.',
  spans: ['years'],
  reach: 'From 10,000 years ago to 1850 CE, rated at ten moments.',
  covers: { years: [-7999, 1850] },
  // A hut with a field before it: how people lived.
  icon: ['M4 12l6-6 6 6', 'M6 10.5V17h8v-6.5', 'M9 17v-3h2v3', 'M17 19h4', 'M3 20h11', 'M18 15v4'],
  why: 'ways',
});
