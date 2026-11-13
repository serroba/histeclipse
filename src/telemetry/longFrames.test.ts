import { describe, expect, it } from 'vitest';

import {
  type FrameScript,
  frameAttributes,
  invokerText,
  type LongFrame,
  namesAttributes,
  scriptUrl,
} from './longFrames';

const ORIGIN = 'https://histeclipse.example';

function script(overrides: Partial<FrameScript> = {}): FrameScript {
  return {
    invoker: 'FrameRequestCallback',
    invokerType: 'user-callback',
    sourceFunctionName: 'render',
    sourceURL: `${ORIGIN}/assets/index-abc.js?v=1#top`,
    duration: 20,
    forcedStyleAndLayoutDuration: 0,
    ...overrides,
  };
}

/** A frame from 1000 to 1180 ms: scripts, then style and layout from 1100, render from 1090. */
function frame(overrides: Partial<LongFrame> = {}): LongFrame {
  return {
    startTime: 1000,
    duration: 180,
    blockingDuration: 130,
    renderStart: 1090,
    styleAndLayoutStart: 1100,
    firstUIEventTimestamp: 0,
    scripts: [],
    ...overrides,
  };
}

describe('scriptUrl', () => {
  it('sends our own script as its path, without query or hash', () => {
    expect(scriptUrl(`${ORIGIN}/assets/index-abc.js?token=x#y`, ORIGIN)).toBe(
      '/assets/index-abc.js',
    );
  });

  it('names only the kind of any other script', () => {
    expect(scriptUrl('chrome-extension://abcdef/content.js', ORIGIN)).toBe('extension');
    expect(scriptUrl('moz-extension://abcdef/content.js', ORIGIN)).toBe('extension');
    expect(scriptUrl('https://elsewhere.example/tracker.js?id=me', ORIGIN)).toBe('other');
    expect(scriptUrl('not a url', ORIGIN)).toBe('other');
  });

  it('leaves no URL as none', () => {
    expect(scriptUrl('', ORIGIN)).toBe('');
  });
});

describe('invokerText', () => {
  it('keeps an element and event as they are', () => {
    expect(invokerText('BUTTON#play.onclick', ORIGIN)).toBe('BUTTON#play.onclick');
  });

  it('strips any URL in it as scriptUrl does', () => {
    expect(invokerText(`${ORIGIN}/assets/a.js?x=1`, ORIGIN)).toBe('/assets/a.js');
    expect(invokerText('https://elsewhere.example/b.js?id=me', ORIGIN)).toBe('other');
  });

  it('cuts a long one short', () => {
    expect(invokerText('x'.repeat(500), ORIGIN)).toHaveLength(120);
  });
});

describe('frameAttributes', () => {
  it('splits the frame into its style and layout and its render time', () => {
    expect(frameAttributes(frame(), ORIGIN)).toEqual({
      'loaf.start_time': 1000,
      'loaf.duration': 180,
      'loaf.blocking_duration': 130,
      'loaf.input': false,
      'loaf.script_count': 0,
      'loaf.script_duration': 0,
      'loaf.forced_style_and_layout_duration': 0,
      'loaf.render_start': 90,
      'loaf.render_duration': 90,
      'loaf.style_and_layout_start': 100,
      'loaf.style_and_layout_duration': 80,
    });
  });

  it('leaves the render and the style and layout out of a frame that did not get there', () => {
    const attributes = frameAttributes(
      frame({ renderStart: 0, styleAndLayoutStart: 0, firstUIEventTimestamp: 995 }),
      ORIGIN,
    );
    expect(attributes).not.toHaveProperty('loaf.render_duration');
    expect(attributes).not.toHaveProperty('loaf.style_and_layout_duration');
    expect(attributes['loaf.input']).toBe(true);
  });

  it('names the longest scripts, longest first, and sums them all', () => {
    const scripts = [
      script({ duration: 5, sourceFunctionName: 'a' }),
      script({ duration: 40.04, sourceFunctionName: 'b', forcedStyleAndLayoutDuration: 12 }),
      script({ duration: 10, sourceFunctionName: 'c', sourceURL: 'chrome-extension://x/y.js' }),
    ];
    const attributes = frameAttributes(frame({ scripts }), ORIGIN, 'inp.loaf', 2);
    expect(attributes).toMatchObject({
      'inp.loaf.script_count': 3,
      'inp.loaf.script_duration': 55,
      'inp.loaf.forced_style_and_layout_duration': 12,
      'inp.loaf.script.0.function': 'b',
      'inp.loaf.script.0.duration': 40,
      'inp.loaf.script.0.forced_style_and_layout_duration': 12,
      'inp.loaf.script.0.source_url': '/assets/index-abc.js',
      'inp.loaf.script.0.invoker': 'FrameRequestCallback',
      'inp.loaf.script.0.invoker_type': 'user-callback',
      'inp.loaf.script.1.function': 'c',
      'inp.loaf.script.1.source_url': 'extension',
    });
    expect(attributes).not.toHaveProperty('inp.loaf.script.2.function');
  });
});

describe('namesAttributes', () => {
  it('says how many names were shown, of how many, and whether the globe turned', () => {
    expect(namesAttributes({ shown: 30, total: 412, turning: true })).toEqual({
      'app.names.shown': 30,
      'app.names.total': 412,
      'app.turning': true,
    });
  });
});
