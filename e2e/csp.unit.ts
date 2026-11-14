import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { contentSecurityPolicy, inlineScriptHashes, sitePolicy } from '../vite.csp';

function sources(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return sources(path);
    return path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : [];
  });
}

describe('the site’s Content-Security-Policy (#240)', () => {
  it('hashes inline scripts only, not those loaded from a file', () => {
    const html = '<script type="module" src="/src/main.ts"></script><script>go()</script>';
    expect(inlineScriptHashes(html)).toEqual([
      "'sha256-5KYv+PUboo5h+0+YAtGRPbwv5d/QxzHslP4YGnUaxRw='",
    ]);
  });

  it('allows neither inline code nor eval, beyond the boot script it names by hash', () => {
    const policy = sitePolicy();
    expect(policy).not.toMatch(/'unsafe-inline'|'unsafe-eval'/);
    expect(policy).toMatch(/script-src 'self' 'sha256-[A-Za-z0-9+/]+=' /);
    expect(policy).toMatch(/object-src 'none'/);
  });

  it('changes with the boot script, so a stale copy in production is caught', () => {
    expect(contentSecurityPolicy('<script>a()</script>')).not.toBe(
      contentSecurityPolicy('<script>b()</script>'),
    );
  });

  it('is never undone by a style attribute: styles go through the style object', () => {
    const src = new URL('../src', import.meta.url).pathname;
    const offenders = sources(src).filter((path) =>
      /\bstyle:\s*`|['"]style['"]\s*:|setAttribute\(\s*['"]style['"]/.test(
        readFileSync(path, 'utf8'),
      ),
    );
    expect(offenders).toEqual([]);
  });
});
