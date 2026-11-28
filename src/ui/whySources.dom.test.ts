// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as content from '../sources/content';
import { SOURCES } from '../sources/registry';
import { copyFrom, sourceItem, sourceLink } from './whySources';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('a source as the why panel shows it (#220)', () => {
  it('Given a source, Then its link opens beside the site, named as the registry names it', () => {
    const link = sourceLink(SOURCES.archaeoglobe);
    expect(link.href).toBe('https://doi.org/10.1126/science.aax1192');
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
    expect(link.textContent).toBe(SOURCES.archaeoglobe.name);
  });

  it('Given a source with a DOI, Then its item gives the full reference, its licence and its BibTeX', () => {
    const item = sourceItem(content, 'archaeoglobe');
    expect(item.dataset['kind']).toBe(SOURCES.archaeoglobe.kind);
    expect(item.querySelector('.why-cite')?.textContent).toBe(content.CITATIONS.archaeoglobe);
    expect(item.querySelector('.why-licence')?.textContent).toBe('CC0 1.0');
    expect(item.querySelector('.why-licence.is-nc')).toBeNull();
    expect(item.querySelector<HTMLAnchorElement>('a[aria-label^="BibTeX"]')?.href).toBe(
      'https://api.crossref.org/works/10.1126/science.aax1192/transform/application/x-bibtex',
    );
  });

  it('Given non-commercial terms, Then the licence is flagged', () => {
    const item = sourceItem(content, 'gvp');
    expect(item.querySelector('.why-licence.is-nc')).not.toBeNull();
  });

  it('Given Copy reference, Then the citation goes on the clipboard and the button says so', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const item = sourceItem(content, 'archaeoglobe');
    const copy = item.querySelector<HTMLButtonElement>('button.why-cite-action');
    copy?.click();
    expect(writeText).toHaveBeenCalledWith(content.citation('archaeoglobe'));
    await vi.waitFor(() => {
      expect(copy?.textContent).toBe('Copied');
    });
    vi.advanceTimersByTime(1600);
    expect(copy?.textContent).toBe('Copy reference');
  });

  it('Given the clipboard refuses, Then the button says it could not copy', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.reject(new Error('no')) } });
    const button = document.createElement('button');
    button.textContent = 'Copy';
    copyFrom(button, 'text');
    await vi.waitFor(() => {
      expect(button.textContent).toBe('Could not copy');
    });
  });
});
