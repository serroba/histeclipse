/** The lunar eclipse catalog in `public/data/lunar/`. */

import * as v from 'valibot';

import {
  EclipseCatalog,
  finite,
  geoPoint,
  integer,
  julianDayTT,
  type CatalogIndex,
  type Fetch,
} from './catalog';

export { CatalogError, greatestEclipseUT, yearOf, type Fetch } from './catalog';

const LunarEclipseSchema = v.strictObject({
  /** Greatest eclipse, Terrestrial Time. Subtract `deltaT` seconds for Universal Time. */
  jdTT: julianDayTT,
  kind: v.picklist(['penumbral', 'partial', 'total']),
  umbralMagnitude: finite,
  penumbralMagnitude: finite,
  /** Moon's distance from the shadow axis in Earth radii; positive when it passes north. */
  gamma: finite,
  /** TT − UT in seconds, from the model named in the index. */
  deltaT: integer,
  /** Where the Moon is overhead at greatest eclipse. */
  sublunar: geoPoint,
});

export type LunarEclipse = v.InferOutput<typeof LunarEclipseSchema>;
export type LunarEclipseKind = LunarEclipse['kind'];
export type LunarCatalogIndex = CatalogIndex;
export type LunarCatalog = EclipseCatalog<LunarEclipse>;

export const LunarCatalog = {
  load(baseUrl: string, fetchJson: Fetch): Promise<LunarCatalog> {
    return EclipseCatalog.load(baseUrl, fetchJson, 'lunar', LunarEclipseSchema);
  },
};
