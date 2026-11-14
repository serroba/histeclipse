/**
 * The site's Content-Security-Policy (#240), in one place. `vite preview` sends it, so the
 * end-to-end suite runs under it and any script, style, image or connection it would block
 * fails a test as a console error. Production sends the same string from Cloudflare (a
 * response-header rule on histeclipse.limits.world); a live test checks the two agree.
 *
 * Print it with `pnpm csp`.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/** sha256 of each inline `<script>` in index.html, as CSP writes a hash source. */
export function inlineScriptHashes(html: string): string[] {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
    ([, body = '']) => `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`,
  );
}

/**
 * The `<style>` elements phoria2 (pinned, see package.json) adds to the page for its charts,
 * tooltips and labels, by hash. A new version that changes them fails the charts' tests.
 */
export const PHORIA_STYLES = [
  "'sha256-eH7lkNfVWkAJh/3jBhOc8V44p7OapCt1N3xJZ+z4Vtw='",
  "'sha256-6pEzLQ0CbJcgi21pTrRPpxCkuHwfi1rLmPCnvUCrgPc='",
  "'sha256-WPerxgaSYkDXZQaLKQDB+4ewBM5lj6r2v/Zl7rwoRQw='",
];

/** The policy, for the page `html` (index.html as written, or as built: the same scripts). */
export function contentSecurityPolicy(html: string): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // The app's modules, the boot script that preloads the first view's data, WebAssembly for
    // the search model (onnxruntime), and the analytics beacon Cloudflare's edge adds.
    'script-src': [
      "'self'",
      ...inlineScriptHashes(html),
      "'wasm-unsafe-eval'",
      'https://static.cloudflareinsights.com',
    ],
    // The site's stylesheets and phoria2's three; no style attributes (styles are set
    // through the style object, which a policy does not govern).
    'style-src': ["'self'", ...PHORIA_STYLES],
    // Maps and textures are the site's own; pictures are Wikimedia Commons thumbnails, and the
    // Smithsonian's photographs of volcanoes.
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      'https://upload.wikimedia.org',
      'https://thumb.wikimedia.org',
      'https://volcano.si.edu',
    ],
    // Telemetry to Honeycomb, and the beacon's reports to Cloudflare.
    'connect-src': ["'self'", 'https://api.honeycomb.io', 'https://cloudflareinsights.com'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'self'"],
  };
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ');
}

/** The policy for the repository's index.html. */
export function sitePolicy(): string {
  return contentSecurityPolicy(readFileSync(new URL('index.html', import.meta.url), 'utf8'));
}
