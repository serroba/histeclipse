/**
 * Whom the planetary boundaries' story credits (#434, #453): the report, the records its chart
 * draws, and what the globe shows as the chart plays, each with its licence. Kept apart from the
 * sheet, which only places it.
 */

import { element } from '../../ui/dom';

export function boundaryCredits(): HTMLElement {
  return element(
    'p',
    { class: 'stage-legend' },
    'From the ',
    element('a', { href: 'https://doi.org/10.48485/pik.2026.25' }, 'Planetary Health Check 2026'),
    ' (Caesar, Sakschewski et al., PBScience, Potsdam Institute for Climate Impact Research), CC BY 4.0, and ',
    element('a', { href: 'https://doi.org/10.1126/sciadv.adh2458' }, 'Richardson et al. (2023)'),
    '. Temperature: ',
    element('a', { href: 'https://doi.org/10.1594/PANGAEA.683655' }, 'EPICA Dome C'),
    ' (Jouzel et al. 2007, CC BY 3.0), ',
    element('a', { href: 'https://doi.org/10.1038/s41586-021-03984-4' }, 'Osman et al. (2021)'),
    ', ',
    element('a', { href: 'https://doi.org/10.1038/s41561-019-0400-0' }, 'PAGES 2k (2019)'),
    ' (both from NOAA NCEI, accessed 12 November 2026; no licence stated, cited as NOAA asks) and ',
    element('a', { href: 'https://doi.org/10.1029/2019JD032361' }, 'HadCRUT5'),
    ' (Met Office, Open Government Licence v3), as the report’s Figure 1 cites them. On the globe as the chart draws: land temperature from ',
    element('a', { href: 'https://doi.org/10.1038/s41597-021-01009-3' }, 'Krapp et al. (2021)'),
    ' (CC BY 4.0) and, from 1850, ',
    element('a', { href: 'https://doi.org/10.5194/essd-12-3469-2020' }, 'Berkeley Earth'),
    ' (Rohde & Hausfather 2020; CC BY-NC 4.0); ice sheets from ',
    element('a', { href: 'https://doi.org/10.1594/PANGAEA.905800' }, 'PaleoMIST 1.0'),
    ' (Gowan et al. 2021, CC BY 4.0) with ',
    element('a', { href: 'https://osf.io/7jen3/' }, 'Batchelor et al. (2019)'),
    '’s outlines (no licence stated) and today’s ice to the coast from ',
    element('a', { href: 'https://www.naturalearthdata.com' }, 'Natural Earth'),
    ' (public domain); sea level from ',
    element('a', { href: 'https://doi.org/10.1038/nature07158' }, 'Bintanja & van de Wal (2008)'),
    ' (via NOAA, no licence stated), laid on NOAA’s ',
    element(
      'a',
      { href: 'https://www.ncei.noaa.gov/products/etopo-global-relief-model' },
      'ETOPO1',
    ),
    ' depths (public domain); sea ice from the ',
    element('a', { href: 'https://doi.org/10.7265/a98x-0f50' }, 'NSIDC Sea Ice Index'),
    ' (free to use, cited) and the ',
    element('a', { href: 'https://doi.org/10.5194/cp-17-1065-2021' }, 'PMIP4'),
    ' glacial runs (CC BY 4.0). The drawings are this site’s own.',
  );
}
