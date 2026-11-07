/**
 * "Why this?": one panel that says, for anything on screen, what it shows, where it comes from
 * and how this site used it, with each source's kind, link and licence; and the marks (an open
 * book) that open it, beside the things they explain. The same panel lists what is on screen
 * now, and every source the site uses.
 *
 * DOM glue, covered by the Playwright suite; what it says is in `sources/registry.ts`.
 */

import {
  SOURCES,
  WHYS,
  type Source,
  type SourceId,
  type SourceKind,
  type WhyId,
} from '../sources/registry';
import { element } from './dom';
import { bookIcon, KIND_NAMES, kindIcon } from './icons';

export interface WhySheet {
  readonly dialog: HTMLDialogElement;
  /** A book mark that opens the why of `id`; `label` names what it explains. */
  mark(id: WhyId | (() => WhyId), label: string): HTMLButtonElement;
  open(id: WhyId): void;
  /** Every source the site uses, grouped by kind. */
  openAll(): void;
  /** Fill `list` with the whys on screen, each with its mark and its sources' links. */
  renderOnScreen(list: HTMLElement, ids: readonly WhyId[]): void;
}

/** A source's link, opened beside the site. */
function sourceLink(source: Source): HTMLAnchorElement {
  return element(
    'a',
    { href: source.url, target: '_blank', rel: 'noopener noreferrer' },
    source.name,
  );
}

/** A source as the panel lists it: its kind, its full reference and link, its licence. */
function sourceItem(source: Source): HTMLElement {
  const kind = element('span', { class: 'why-kind', title: KIND_NAMES[source.kind] });
  kind.append(kindIcon(source.kind));
  return element(
    'li',
    { class: 'why-source', 'data-kind': source.kind },
    kind,
    element(
      'div',
      { class: 'why-source-text' },
      sourceLink(source),
      element('span', { class: 'why-cite' }, source.cite),
      ...(source.licence === undefined
        ? []
        : [
            element(
              'span',
              {
                class: `why-licence${'nonCommercial' in source ? ' is-nc' : ''}`,
                title:
                  'nonCommercial' in source
                    ? 'Non-commercial terms: the site may use it only as it does, without charge'
                    : 'Licence',
              },
              source.licence,
            ),
          ]),
    ),
  );
}

function section(title: string, ...content: (Node | string)[]): HTMLElement {
  return element('section', { class: 'why-section' }, element('h3', {}, title), ...content);
}

export function createWhySheet(): WhySheet {
  const heading = element('h2', { id: 'why-title' });
  const close = element(
    'button',
    { type: 'button', class: 'famous-close', 'aria-label': 'Close' },
    '×',
  );
  const body = element('div', { class: 'why-body' });
  const headIcon = element('span', { class: 'why-head-icon' });
  headIcon.append(bookIcon(20));
  const dialog = element(
    'dialog',
    { class: 'famous-dialog why-dialog', 'aria-labelledby': 'why-title' },
    element('header', { class: 'famous-header' }, headIcon, heading, close),
    body,
  );
  close.addEventListener('click', () => {
    dialog.close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dialog.open) dialog.close();
  });

  function show(): void {
    // Not modal: the globe stays in reach, as the Layers panel leaves it.
    if (!dialog.open) dialog.show();
    body.scrollTop = 0;
  }

  function open(id: WhyId): void {
    const why = WHYS[id];
    heading.textContent = why.title;
    const sources = why.sources.map((source) => SOURCES[source]);
    body.replaceChildren(
      section('What you see', element('p', {}, why.what)),
      section(
        'Where it comes from',
        element('ul', { class: 'why-sources' }, ...sources.map(sourceItem)),
      ),
      ...('how' in why ? [section('How this site used it', element('p', {}, why.how))] : []),
      ...('others' in why ? [section('Other views', element('p', {}, why.others))] : []),
      element('button', { type: 'button', class: 'why-all' }, 'All sources the site uses'),
    );
    body.querySelector('.why-all')?.addEventListener('click', openAll);
    show();
  }

  function openAll(): void {
    heading.textContent = 'All sources';
    const kinds: readonly SourceKind[] = ['paper', 'dataset', 'model', 'imagery', 'catalogue'];
    const entries = Object.entries(SOURCES) as [SourceId, Source][];
    body.replaceChildren(
      ...kinds.map((kind) =>
        section(
          `${KIND_NAMES[kind]}s`,
          element(
            'ul',
            { class: 'why-sources' },
            ...entries
              .filter(([, source]) => source.kind === kind)
              .sort(([, a], [, b]) => a.name.localeCompare(b.name))
              .map(([, source]) => sourceItem(source)),
          ),
        ),
      ),
    );
    show();
  }

  return {
    dialog,
    open,
    openAll,
    mark(id, label) {
      const button = element('button', {
        type: 'button',
        class: 'why-mark',
        'aria-label': `Why: ${label}`,
        title: 'Where this comes from',
      });
      button.append(bookIcon());
      button.addEventListener('click', (event) => {
        // A mark inside a label or a summary is its own control, not the one it sits in.
        event.preventDefault();
        event.stopPropagation();
        open(typeof id === 'function' ? id() : id);
      });
      return button;
    },
    renderOnScreen(list, ids) {
      // Each source linked once, where it first appears; named plainly after that.
      const linked = new Set<SourceId>();
      list.replaceChildren(
        ...ids.map((id) => {
          const why = WHYS[id];
          const names = why.sources.flatMap((source, index) => {
            const parts: (Node | string)[] = index === 0 ? [] : [', '];
            if (linked.has(source)) parts.push(SOURCES[source].name);
            else {
              linked.add(source);
              parts.push(sourceLink(SOURCES[source]));
            }
            return parts;
          });
          return element(
            'li',
            { class: 'why-row', 'data-why': id },
            this.mark(id, why.title),
            element('span', { class: 'why-row-title' }, why.title),
            element('span', { class: 'why-row-sources' }, ...names),
          );
        }),
        element(
          'li',
          { class: 'why-row' },
          element('button', { type: 'button', class: 'why-all' }, 'All sources the site uses'),
        ),
      );
      list.querySelector('.why-all')?.addEventListener('click', openAll);
    },
  };
}
