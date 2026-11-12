/** What deep time's bar says of Batchelor et al.'s ice-sheet outlines (moved out of the bar). */

import type { IceOutlines } from '../data/iceOutlines';

/** How a span of thousands of years ago reads: in thousands, or in millions from 1,000 ka. */
function kaSpan(fromKa: number, toKa: number): string {
  if (toKa >= 1000) {
    const ma = (ka: number) => (ka / 1000).toLocaleString('en', { maximumFractionDigits: 2 });
    return `${ma(fromKa)}–${ma(toKa)} million years ago`;
  }
  const years = (ka: number) => (ka * 1000).toLocaleString('en');
  return `${years(fromKa)}–${years(toKa)} years ago`;
}

/** What the bar says about Batchelor et al.'s outlines of the time slice shown, if any. */
export function iceOutlineText(outlines: IceOutlines | null): string | null {
  if (outlines === null) return null;
  const credit = 'Batchelor et al. (2019)';
  const compare = 'Where the white ice and the outlines differ, the reconstructions disagree.';
  if (outlines.min.length === 0 && outlines.max.length === 0) {
    return `Outlines: ${credit}’s best estimate for the Last Glacial Maximum, about 26,500 years ago. ${compare}`;
  }
  const point = /^(\d+) ka$/.exec(outlines.name);
  const when =
    point?.[1] === undefined
      ? `${outlines.name} (${kaSpan(outlines.fromKa, outlines.toKa)})`
      : `about ${(Number(point[1]) * 1000).toLocaleString('en')} years ago`;
  return `Outlines: ${credit}, ${when}: their best estimate (solid gold), minimum (dotted blue) and maximum (dashed red) of the ice sheets at their largest. ${compare}`;
}
