import { layer } from './layer';

/** How people lived by region (ArchaeoGLOBE): foraging, herding, farming, towns. */
export const ways = layer({
  id: 'ways',
  label: 'Ways of life',
  about:
    'How people lived by region, as archaeologists rated it (ArchaeoGLOBE): foraging, herding, farming, towns.',
  spans: ['years'],
  reach: 'From 10,000 years ago to 1850 CE, rated at ten moments.',
  covers: { years: [-7999, 1850] },
});
