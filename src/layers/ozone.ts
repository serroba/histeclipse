import { layer } from './layer';

/** The Antarctic ozone hole each spring since 1979, and the gases that made it (#722). */
export const ozone = layer({
  id: 'ozone',
  label: 'The ozone hole',
  about:
    'Ozone over the whole Earth each October, the Antarctic hole an opening in it (MSR-2 reanalysis, Copernicus); from 2003 the ozone layer in 3D, day by day from July to December (CAMS reanalysis, Copernicus); with the hole’s area each spring (NASA Ozone Watch) and the gases that made it (NOAA) beside the globe.',
  spans: ['years'],
  reach:
    'Each October from 1970 to 2025, none for 1977 and 1978, with gaps before 1979; the hole’s area from 1979, the gases from 1992.',
  covers: { years: [1970, 2025], gaps: [1977, 1978] },
});
