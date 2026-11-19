/**
 * The month's sea surface temperature anomaly (#886), or a rain or temperature composite (#891,
 * #892), painted on the map over Earth's surface (`globe/packedMaps`).
 */

import { HISTORY_PAINT_ORDER } from '../../globe/layerHost';
import { packedMapLayer } from '../../globe/packedMaps';

export const ensoMapLayer = packedMapLayer(HISTORY_PAINT_ORDER.enso, 'ensoSst');
