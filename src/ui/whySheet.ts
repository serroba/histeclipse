/**
 * "Why this?": one panel that says, for anything on screen, what it shows, where it comes from
 * and how this site used it, with each source's kind, link and licence; and the marks (an open
 * book) that open it, beside the things they explain. The same panel lists what is on screen
 * now, and every source the site uses. DOM glue, covered by the Playwright suite; what it says
 * is in `sources/registry.ts`.
 */

import {
  bibtexUrl,
  citation,
  SOURCES,
  WHYS,
  type Source,
  type SourceId,
  type SourceKind,
  type WhyId,
  type WhyView,
} from '../sources/registry';
import type { HereFact } from '../sources/here';
import { element } from './dom';
import { bookIcon, KIND_NAMES, kindIcon } from './icons';
import './whySheet.css';

export interface WhySheet {
  readonly dialog: HTMLDialogElement;
  /** A book mark that asks for the why of `id`; `label` names what it explains. */
  mark(id: WhyId | (() => WhyId), label: string): HTMLButtonElement;
  /**
   * Show a why, every source ('all'), what is at the place picked ('here'), or nothing: as the
   * view (and its link) has it. `version` changes when what 'here' says may have.
   */
  show(view: WhyView | null, version?: string): void;
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

/** Put `text` on the clipboard; say on `button` whether it worked, for a moment. */
function copyFrom(button: HTMLButtonElement, text: string): void {
  const label = button.textContent;
  const say = (words: string): void => {
    button.textContent = words;
    window.setTimeout(() => {
      button.textContent = label;
    }, 1600);
  };
  navigator.clipboard.writeText(text).then(
    () => {
      say('Copied');
    },
    () => {
      say('Could not copy');
    },
  );
}

/** A source as the panel lists it: its kind, its full reference and link, its licence, and
 * ways to cite it. */
function sourceItem(source: Source): HTMLElement {
  const copy = element(
    'button',
    {
      type: 'button',
      class: 'why-cite-action',
      'aria-label': `Copy the reference to ${source.name}`,
    },
    'Copy reference',
  );
  copy.addEventListener('click', () => {
    copyFrom(copy, citation(source));
  });
  const bibtex = bibtexUrl(source);
  const actions = element(
    'span',
    { class: 'why-cite-actions' },
    copy,
    ...(bibtex === null
      ? []
      : [
          element(
            'a',
            {
              class: 'why-cite-action',
              href: bibtex,
              target: '_blank',
              rel: 'noopener noreferrer',
              'aria-label': `BibTeX for ${source.name}, from Crossref`,
            },
            'BibTeX',
          ),
        ]),
  );
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
      actions,
    ),
  );
}

function section(title: string, ...content: (Node | string)[]): HTMLElement {
  return element('section', { class: 'why-section' }, element('h3', {}, title), ...content);
}

/** What is at the place picked, for the 'here' view; null with no place picked. */
export interface HereView {
  readonly place: string;
  readonly facts: readonly HereFact[];
}

/** What a why says of the moment shown: for deep time's map, the period's own evidence. */
export interface WhyMoment {
  readonly title: string;
  readonly lines: readonly string[];
  readonly sources: readonly SourceId[];
}

export function createWhySheet(
  /** Asked for a why, every source, or none: the view decides, and the panel follows it. */
  onRequest: (view: WhyView | null) => void,
  /** What each layer has at the place picked, worked out when asked. */
  here: () => HereView | null = () => null,
  /** What a why says of the moment shown, when it has something of its own to say. */
  moment: (id: WhyId) => WhyMoment | null = () => null,
): WhySheet {
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
    onRequest(null);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dialog.open) onRequest(null);
  });
  // The link to what is open: the address, which carries ?why= while the panel is open.
  function linkButton(): HTMLButtonElement {
    const button = element('button', { type: 'button', class: 'why-all' }, 'Copy a link to this');
    button.addEventListener('click', () => {
      copyFrom(button, window.location.href);
    });
    return button;
  }
  let shown: WhyView | null = null;
  let shownVersion = '';

  /** A book mark that asks for the why of `id`; `label` names what it explains. */
  function markFor(id: WhyId | (() => WhyId), label: string): HTMLButtonElement {
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
      onRequest(typeof id === 'function' ? id() : id);
    });
    return button;
  }

  function openHere(): void {
    const view = here();
    heading.textContent = view === null ? 'Why here?' : `Here: ${view.place}`;
    body.replaceChildren(
      ...(view === null
        ? [element('p', { class: 'why-here-empty' }, 'Tap the globe to pick a place.')]
        : view.facts.length === 0
          ? [
              element(
                'p',
                { class: 'why-here-empty' },
                'No layer on the map has a record of its own here. Turn on States, Ways of life or Rocks in Layers.',
              ),
            ]
          : [
              element(
                'ul',
                { class: 'why-here' },
                ...view.facts.map((fact) =>
                  element(
                    'li',
                    {},
                    element('strong', {}, fact.title),
                    ' ',
                    fact.text,
                    ' ',
                    ...(fact.link === undefined
                      ? []
                      : [
                          element(
                            'a',
                            { href: fact.link.href, target: '_blank', rel: 'noopener noreferrer' },
                            fact.link.label,
                          ),
                          ' ',
                        ]),
                    markFor(fact.why, fact.title),
                  ),
                ),
              ),
            ]),
      element('div', { class: 'why-actions' }, linkButton()),
    );
    reveal();
  }

  function reveal(): void {
    // Not modal: the globe stays in reach, as the Layers panel leaves it.
    if (!dialog.open) dialog.show();
    body.scrollTop = 0;
  }

  function open(id: WhyId): void {
    const why = WHYS[id];
    heading.textContent = why.title;
    const sources = why.sources.map((source) => SOURCES[source]);
    // For a reconstruction: the evidence it rests on, how sure each part is, and where to read
    // on, ahead of the full list of its sources.
    const evidence =
      'evidence' in why
        ? [
            section(
              'The evidence',
              element(
                'ul',
                { class: 'why-evidence' },
                ...why.evidence.map((item) =>
                  element(
                    'li',
                    {},
                    element('strong', {}, item.name),
                    ' ',
                    item.says,
                    ' ',
                    sourceLink(SOURCES[item.source]),
                  ),
                ),
              ),
            ),
          ]
        : [];
    const certainty =
      'certainty' in why
        ? [
            section(
              'How sure',
              element(
                'ul',
                { class: 'why-certainty' },
                ...why.certainty.map((line) => element('li', {}, line)),
              ),
            ),
          ]
        : [];
    const reading =
      'reading' in why
        ? [
            section(
              'Read on',
              element(
                'ol',
                { class: 'why-sources why-reading' },
                ...why.reading.map((source) => sourceItem(SOURCES[source])),
              ),
            ),
          ]
        : [];
    const now = moment(id);
    const then =
      now === null
        ? []
        : [
            section(
              now.title,
              ...now.lines.map((line) => element('p', {}, line)),
              element(
                'p',
                { class: 'why-then-sources' },
                ...now.sources.flatMap((source, index) => [
                  index === 0 ? 'Read: ' : ' · ',
                  sourceLink(SOURCES[source]),
                ]),
              ),
            ),
          ];
    body.replaceChildren(
      section('What you see', element('p', {}, why.what)),
      ...then,
      ...evidence,
      ...certainty,
      ...('others' in why ? [section('Other views', element('p', {}, why.others))] : []),
      ...reading,
      section(
        'Where it comes from',
        element('ul', { class: 'why-sources' }, ...sources.map(sourceItem)),
      ),
      ...('how' in why ? [section('How this site used it', element('p', {}, why.how))] : []),
      element(
        'div',
        { class: 'why-actions' },
        element('button', { type: 'button', class: 'why-all' }, 'All sources the site uses'),
        linkButton(),
      ),
    );
    body.querySelector('.why-all')?.addEventListener('click', () => {
      onRequest('all');
    });
    reveal();
  }

  function openAll(): void {
    heading.textContent = 'All sources';
    const kinds: readonly SourceKind[] = [
      'paper',
      'dataset',
      'model',
      'imagery',
      'catalogue',
      'reference',
    ];
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
      element('div', { class: 'why-actions' }, linkButton()),
    );
    reveal();
  }

  return {
    dialog,
    show(view, version = '') {
      if (view === shown && version === shownVersion) return;
      shown = view;
      shownVersion = version;
      if (view === null) {
        if (dialog.open) dialog.close();
      } else if (view === 'all') openAll();
      else if (view === 'here') openHere();
      else open(view);
    },
    mark: markFor,
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
      list.querySelector('.why-all')?.addEventListener('click', () => {
        onRequest('all');
      });
    },
  };
}
