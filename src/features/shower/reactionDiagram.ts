/**
 * The chemistry of the carbon-14 shower as a diagram (#282), for the steps where it happens: a
 * neutron turning nitrogen-14 into carbon-14 (the nucleus counted, 7 protons and 7 neutrons to 6
 * and 8), and the carbon-14 joining oxygen. Colours as in the animation; labels say the rest.
 *
 * DOM glue, covered by the Playwright suite.
 */

import type { ShowerStep } from '../../globe/showerSteps';
import { css, PALETTE } from '../../story/palette';
import './reactionDiagram.css';

const NS = 'http://www.w3.org/2000/svg';

interface Particle {
  readonly x: number;
  readonly r: number;
  readonly colour: string;
  readonly name: string;
  readonly detail?: string;
}

function svg(name: string, attributes: Record<string, string>, text?: string): SVGElement {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

/** A row of particles joined by signs, and a line saying what it means. */
function equation(
  particles: readonly Particle[],
  signs: readonly { readonly x: number; readonly sign: string }[],
  note: string,
  label: string,
): SVGElement {
  const root = svg('svg', {
    class: 'reaction-diagram',
    viewBox: '0 0 560 124',
    role: 'img',
    'aria-label': label,
    'data-testid': 'reaction-diagram',
  });
  for (const { x, r, colour, name, detail } of particles) {
    root.append(
      svg('circle', { cx: String(x), cy: '46', r: String(r), fill: colour }),
      svg('text', { x: String(x), y: '51', class: 'reaction-name' }, name),
    );
    if (detail !== undefined) {
      root.append(
        svg('text', { x: String(x), y: String(46 + r + 16), class: 'reaction-detail' }, detail),
      );
    }
  }
  for (const { x, sign } of signs) {
    root.append(svg('text', { x: String(x), y: '53', class: 'reaction-sign' }, sign));
  }
  root.append(svg('text', { x: '280', y: '118', class: 'reaction-note' }, note));
  return root;
}

const NITROGEN = css(PALETTE.nitrogen);
const CARBON = css(PALETTE.carbon14);
const PROTON = css(PALETTE.freedProton);
const NEUTRON = css(PALETTE.neutron);
const OXYGEN = css(PALETTE.oxygen);

/** The diagram for a step, or null for the steps the globe shows on its own. */
export function reactionDiagram(step: ShowerStep): SVGElement | null {
  if (step === 'capture') {
    return equation(
      [
        { x: 40, r: 14, colour: NEUTRON, name: 'n', detail: 'neutron' },
        { x: 150, r: 30, colour: NITROGEN, name: '¹⁴N', detail: '7 protons, 7 neutrons' },
        { x: 360, r: 30, colour: CARBON, name: '¹⁴C', detail: '6 protons, 8 neutrons' },
        { x: 500, r: 14, colour: PROTON, name: 'p', detail: 'proton' },
      ],
      [
        { x: 88, sign: '+' },
        { x: 255, sign: '→' },
        { x: 440, sign: '+' },
      ],
      'A neutron in, a proton out: still 14 particles, one proton fewer, so carbon.',
      'A neutron and nitrogen-14, of 7 protons and 7 neutrons, become carbon-14, of 6 protons and 8 neutrons, and a proton.',
    );
  }
  if (step === 'dioxide') {
    return equation(
      [
        { x: 70, r: 24, colour: CARBON, name: '¹⁴C', detail: 'carbon-14' },
        { x: 210, r: 20, colour: OXYGEN, name: 'O₂', detail: 'oxygen' },
        { x: 430, r: 28, colour: CARBON, name: '¹⁴CO₂', detail: 'carbon dioxide' },
      ],
      [
        { x: 140, sign: '+' },
        { x: 315, sign: '→' },
      ],
      'Chemically like any other carbon: it joins oxygen, and the air carries it.',
      'Carbon-14 and oxygen become carbon dioxide holding carbon-14.',
    );
  }
  return null;
}
