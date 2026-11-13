/**
 * Attributes every span carries, so any slow fetch, error or click can be grouped by what the
 * reader was looking at and by what their GPU can do.
 */

import { parseViewState } from '../state/url';

export type AttributeValue = string | number | boolean;
export type Attributes = Readonly<Record<string, AttributeValue>>;

/** The view the URL describes: the same state a shared link reproduces. */
export function viewAttributes(search: string, now: Date): Attributes {
  const { state } = parseViewState(search, now);
  const layers = [...state.layers].sort();
  const attributes: Record<string, AttributeValue> = {
    'app.mode': state.mode,
    'app.view': state.view,
    'app.focus': state.focus,
    'app.calendar': state.time.date.calendar,
    'app.layers': layers.join(','),
    'app.layer_count': layers.length,
    'app.selection': state.selection?.kind ?? 'none',
    // How names are drawn over the globe: HTML today; WebGL is the experiment in #633.
    'app.names': 'html',
  };
  if (state.ma === null) {
    attributes['app.span'] = 'years';
    attributes['app.year'] = state.time.date.year;
  } else {
    attributes['app.span'] = state.deepScale;
    attributes['app.ma'] = state.ma;
  }
  if (state.selection !== null) {
    attributes['app.selection.year'] = state.selection.date.year;
  }
  return attributes;
}

/** Re-parses only when the URL changes; spans start far more often than the view does. */
export function cachedViewAttributes(now: () => Date): (search: string) => Attributes {
  let lastSearch: string | null = null;
  let last: Attributes = {};
  return (search) => {
    if (search !== lastSearch) {
      lastSearch = search;
      last = viewAttributes(search, now());
    }
    return last;
  };
}

/** The slice of a WebGL context the probe reads; a real context satisfies it. */
export interface GlProbe {
  getParameter(name: number): unknown;
  getExtension(name: string): unknown;
}

const MAX_TEXTURE_SIZE = 0x0d33;
const SOFTWARE_RENDERERS = /swiftshader|llvmpipe|softpipe|software/i;
const UNMASKED_VENDOR_WEBGL = 0x9245;
const UNMASKED_RENDERER_WEBGL = 0x9246;

/**
 * What the device's GPU offers the globe. `webgl2` is null when the browser gives no WebGL 2
 * context, the first suspect when the globe fails to draw.
 */
export function gpuAttributes(webgl2: GlProbe | null, pixelRatio: number): Attributes {
  const attributes: Record<string, AttributeValue> = {
    'gpu.webgl2': webgl2 !== null,
    'display.pixel_ratio': pixelRatio,
  };
  if (webgl2 === null) {
    return attributes;
  }
  const maxTexture = webgl2.getParameter(MAX_TEXTURE_SIZE);
  if (typeof maxTexture === 'number') {
    attributes['gpu.max_texture_size'] = maxTexture;
  }
  // Browsers that hide the real GPU (Firefox, Safari) still answer, with a generic name.
  const debug = webgl2.getExtension('WEBGL_debug_renderer_info') !== null;
  const vendor = webgl2.getParameter(debug ? UNMASKED_VENDOR_WEBGL : 0x1f00);
  const renderer = webgl2.getParameter(debug ? UNMASKED_RENDERER_WEBGL : 0x1f01);
  if (typeof vendor === 'string') attributes['gpu.vendor'] = vendor;
  if (typeof renderer === 'string') {
    attributes['gpu.renderer'] = renderer;
    // Software WebGL (headless browsers, blocklisted GPUs) draws many times slower than any real
    // GPU; flag it so render timings can be read without it.
    attributes['gpu.software'] = SOFTWARE_RENDERERS.test(renderer);
  }
  return attributes;
}

/** A canvas, as far as the probe uses one; a real one satisfies it. */
export interface ProbeCanvas {
  getContext(kind: 'webgl2'): GlProbe | null;
}

function losable(extension: unknown): extension is { loseContext(): void } {
  return typeof extension === 'object' && extension !== null && 'loseContext' in extension;
}

/** Asks a throwaway WebGL 2 context what the GPU offers, then releases it. */
export function probeGpu(canvas: ProbeCanvas, pixelRatio: number): Attributes {
  const gl = canvas.getContext('webgl2');
  const attributes = gpuAttributes(gl, pixelRatio);
  const lose = gl?.getExtension('WEBGL_lose_context');
  if (losable(lose)) lose.loseContext();
  return attributes;
}
