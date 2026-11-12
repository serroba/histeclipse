/**
 * The Sun's part of the carbon-14 story, drawn (#277): a cross-section, core, radiative zone and
 * convective zone, with fusion in the core and its gamma ray; a photon's random walk out, its
 * energy softening from X-rays to visible light; and its 8-minute journey to Earth as red light.
 * The motion is CSS, which stops for readers who ask for reduced motion.
 *
 * DOM glue, covered by the Playwright suite. Values are sourced on #277.
 */

import type { ShowerStep } from '../../globe/showerSteps';
import './sunDiagram.css';

const NS = 'http://www.w3.org/2000/svg';

function svg(name: string, attributes: Record<string, string>, text?: string): SVGElement {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

function frame(label: string): SVGElement {
  return svg('svg', {
    class: 'sun-diagram',
    viewBox: '0 0 560 150',
    role: 'img',
    'aria-label': label,
    'data-testid': 'sun-diagram',
  });
}

/** The Sun cut open at (cx, cy): its zones, with their names. */
function crossSection(root: SVGElement, cx: number, cy: number, r: number): void {
  root.append(
    svg('circle', { cx: String(cx), cy: String(cy), r: String(r), class: 'sun-convective' }),
    svg('circle', { cx: String(cx), cy: String(cy), r: String(r * 0.7), class: 'sun-radiative' }),
    svg('circle', { cx: String(cx), cy: String(cy), r: String(r * 0.25), class: 'sun-core' }),
    svg(
      'text',
      { x: String(cx + r + 8), y: String(cy - r * 0.85), class: 'sun-zone' },
      'convective zone',
    ),
    svg(
      'text',
      { x: String(cx + r + 8), y: String(cy - r * 0.45), class: 'sun-zone' },
      'radiative zone',
    ),
    svg(
      'text',
      { x: String(cx + r + 8), y: String(cy - r * 0.05), class: 'sun-zone' },
      'core, 15 million °C',
    ),
  );
}

/** A zigzag from the centre out to `reach`, as a photon's random walk, drawn step by step. */
function randomWalk(cx: number, cy: number, reach: number): string {
  const points: string[] = [];
  let x = cx;
  let y = cy;
  let seed = 7;
  const next = (): number => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < 90; i += 1) {
    const angle = next() * Math.PI * 2;
    const outward = Math.atan2(y - cy, x - cx);
    // Mostly random, a little outward: it does get out in the end.
    const step = 6;
    x += step * (0.8 * Math.cos(angle) + 0.35 * Math.cos(outward));
    y += step * (0.8 * Math.sin(angle) + 0.35 * Math.sin(outward));
    const d = Math.hypot(x - cx, y - cy);
    if (d > reach) {
      x = cx + ((x - cx) * reach) / d;
      y = cy + ((y - cy) * reach) / d;
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      break;
    }
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `${String(cx)},${String(cy)} ${points.join(' ')}`;
}

/** The diagram for one of the Sun's steps, or null for the others. */
export function sunDiagram(step: ShowerStep): SVGElement | null {
  if (step === 'fusion') {
    const root = frame(
      'The Sun cut open: in its core, at 15 million degrees, hydrogen fuses into helium, giving off gamma rays of 0.511 MeV.',
    );
    crossSection(root, 90, 75, 66);
    root.append(
      svg('circle', { cx: '90', cy: '75', r: '7', class: 'sun-flash' }),
      svg('text', { x: '420', y: '60', class: 'sun-equation' }, '4 ¹H → ⁴He + energy'),
      svg(
        'text',
        { x: '420', y: '86', class: 'sun-photon-label' },
        'γ gamma ray: 0.511 MeV, 1.2 × 10²⁰ Hz',
      ),
      svg(
        'text',
        { x: '420', y: '108', class: 'sun-note' },
        'each positron the chain makes meets an electron',
      ),
    );
    return root;
  }
  if (step === 'escape') {
    const root = frame(
      'A photon’s random walk from the core out through the radiative zone, about 170,000 years, softening from X-rays to visible light.',
    );
    crossSection(root, 90, 75, 66);
    root.append(
      svg('polyline', { points: randomWalk(90, 75, 46), class: 'sun-walk' }),
      svg(
        'text',
        { x: '420', y: '50', class: 'sun-photon-label' },
        'at the core: X-rays, about 1 keV',
      ),
      svg(
        'text',
        { x: '420', y: '74', class: 'sun-photon-label' },
        'at the surface: visible, about 2.5 eV',
      ),
      svg('text', { x: '420', y: '102', class: 'sun-equation' }, '≈ 170,000 years'),
      svg(
        'text',
        { x: '420', y: '122', class: 'sun-note' },
        'Mitalas & Sills 1992; quick estimates give ten times less',
      ),
    );
    return root;
  }
  if (step === 'journey') {
    const root = frame(
      'Sunlight crosses 150 million km to Earth in 8 minutes 19 seconds; one photon is red light of 680 nm, 441 terahertz, 1.8 electronvolts.',
    );
    root.append(
      svg('circle', { cx: '40', cy: '70', r: '30', class: 'sun-convective' }),
      svg('circle', { cx: '520', cy: '70', r: '9', class: 'sun-earth' }),
      svg('line', { x1: '74', y1: '70', x2: '508', y2: '70', class: 'sun-path' }),
      svg('circle', { cx: '74', cy: '70', r: '6', class: 'sun-red-photon' }),
      svg('text', { x: '290', y: '50', class: 'sun-equation' }, '150 million km in 8 min 19 s'),
      svg(
        'text',
        { x: '290', y: '100', class: 'sun-photon-label' },
        'red light: 680 nm, 441 THz, 1.8 eV',
      ),
      svg(
        'text',
        { x: '290', y: '120', class: 'sun-note' },
        'the colour chlorophyll absorbs; it reflects the green',
      ),
      svg('text', { x: '520', y: '98', class: 'sun-note' }, 'Earth'),
    );
    return root;
  }
  return null;
}
