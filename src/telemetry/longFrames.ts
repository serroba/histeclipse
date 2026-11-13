/**
 * What a long animation frame (LoAF) says about why it was long, as span attributes (#636):
 * how long it took, how much of that went to style and layout and to rendering, and the scripts
 * that ran longest in it. Chrome reports these for frames over 50 ms.
 *
 * Privacy: a script's URL is sent only when it is one of ours, as its path alone (no query, no
 * hash); any other is sent as `extension` or `other`. Invokers that hold a URL get the same.
 */

import type { ScreenNames } from '../util/screenNames';
import type { Attributes, AttributeValue } from './attributes';

/** The fields of a `PerformanceScriptTiming` read here; a real entry satisfies it. */
export interface FrameScript {
  readonly invoker: string;
  readonly invokerType: string;
  readonly sourceFunctionName: string;
  readonly sourceURL: string;
  readonly duration: number;
  readonly forcedStyleAndLayoutDuration: number;
}

/** The fields of a `PerformanceLongAnimationFrameTiming` read here. */
export interface LongFrame {
  readonly startTime: number;
  readonly duration: number;
  readonly blockingDuration: number;
  /** When rendering began (ms since navigation), or 0 for a frame that did not render. */
  readonly renderStart: number;
  /** When style and layout began (ms since navigation), or 0. */
  readonly styleAndLayoutStart: number;
  /** When the first input of the frame was queued, or 0 for a frame with none. */
  readonly firstUIEventTimestamp: number;
  readonly scripts: readonly FrameScript[];
}

/** Longer strings are cut: an invoker or function name is a few words, never more. */
const MAX_TEXT = 120;
const EXTENSION = /^(chrome|moz|safari-web)-extension:$/;

/** A script's URL as sent: its path when it is ours, else only what kind of script it is. */
export function scriptUrl(url: string, origin: string): string {
  if (url === '') return '';
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'other';
  }
  if (parsed.origin === origin) return parsed.pathname;
  return EXTENSION.test(parsed.protocol) ? 'extension' : 'other';
}

/** An invoker as sent: `BUTTON#id.onclick` as it is, any URL in it as `scriptUrl` has it. */
export function invokerText(invoker: string, origin: string): string {
  const cleaned = invoker.replace(/[a-z][a-z0-9+.-]*:\/\/[^\s'"]*/gi, (url) =>
    scriptUrl(url, origin),
  );
  return cleaned.slice(0, MAX_TEXT);
}

/** Tenths of a millisecond: finer says nothing, and the columns read better. */
function ms(value: number): number {
  return Math.round(value * 10) / 10;
}

function scriptAttributes(prefix: string, script: FrameScript, origin: string): Attributes {
  return {
    [`${prefix}.invoker`]: invokerText(script.invoker, origin),
    [`${prefix}.invoker_type`]: script.invokerType,
    [`${prefix}.function`]: script.sourceFunctionName.slice(0, MAX_TEXT),
    [`${prefix}.source_url`]: scriptUrl(script.sourceURL, origin),
    [`${prefix}.duration`]: ms(script.duration),
    [`${prefix}.forced_style_and_layout_duration`]: ms(script.forcedStyleAndLayoutDuration),
  };
}

/**
 * A frame as attributes under `prefix`, with its `scripts` longest scripts. The style and layout
 * time runs from its start to the frame's end, the render time from the render's start: both
 * absent when the frame did not get that far.
 */
export function frameAttributes(
  frame: LongFrame,
  origin: string,
  prefix = 'loaf',
  scripts = 3,
): Attributes {
  const end = frame.startTime + frame.duration;
  const attributes: Record<string, AttributeValue> = {
    [`${prefix}.start_time`]: ms(frame.startTime),
    [`${prefix}.duration`]: ms(frame.duration),
    [`${prefix}.blocking_duration`]: ms(frame.blockingDuration),
    [`${prefix}.input`]: frame.firstUIEventTimestamp > 0,
    [`${prefix}.script_count`]: frame.scripts.length,
    [`${prefix}.script_duration`]: ms(frame.scripts.reduce((sum, s) => sum + s.duration, 0)),
    [`${prefix}.forced_style_and_layout_duration`]: ms(
      frame.scripts.reduce((sum, s) => sum + s.forcedStyleAndLayoutDuration, 0),
    ),
  };
  if (frame.renderStart > 0) {
    attributes[`${prefix}.render_start`] = ms(frame.renderStart - frame.startTime);
    attributes[`${prefix}.render_duration`] = ms(end - frame.renderStart);
  }
  if (frame.styleAndLayoutStart > 0) {
    attributes[`${prefix}.style_and_layout_start`] = ms(
      frame.styleAndLayoutStart - frame.startTime,
    );
    attributes[`${prefix}.style_and_layout_duration`] = ms(end - frame.styleAndLayoutStart);
  }
  const longest = [...frame.scripts].sort((a, b) => b.duration - a.duration).slice(0, scripts);
  longest.forEach((script, index) => {
    Object.assign(
      attributes,
      scriptAttributes(`${prefix}.script.${String(index)}`, script, origin),
    );
  });
  return attributes;
}

/** What was on screen: the names shown over the globe, of how many, and whether it turned. */
export function namesAttributes(names: ScreenNames): Attributes {
  return {
    'app.names.shown': names.shown,
    'app.names.total': names.total,
    'app.turning': names.turning,
  };
}
