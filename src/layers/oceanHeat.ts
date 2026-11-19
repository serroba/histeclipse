import { layer } from './layer';
import { sealevel } from './sealevel';

/** Where the ocean gained heat since 1960, IAP's trend maps (#589). */
export const oceanHeat = layer({
  id: 'oceanHeat',
  label: 'Ocean heat',
  about:
    'Where the ocean has gained heat since 1960, or in the Argo years since 2005, in W/m² (IAP v4.2): heat content, on its own scale, faded where the trend is not significant.',
  spans: ['years'],
  reach: 'Trends over 1960–2025 (0–700 m, 0–2000 m) and 2005–2025 (0–2000 m), shown in the years.',
  icon: sealevel.icon,
  why: 'oceanHeat',
});
