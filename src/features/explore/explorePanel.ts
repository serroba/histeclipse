/**
 * Explore (#727): what there is to see, by topic, without choosing a span first
 * (docs/navigation.md). Topics are tabs; each lists its destinations with what they show and the
 * questions they answer; picking one opens it. Search, for a named thing, is one step away.
 * Like Layers it leaves the globe in reach, and it takes the same side, so one of them is open
 * at a time.
 */

import {
  DESTINATIONS,
  destinationsIn,
  TOPICS,
  type Destination,
  type Topic,
} from '../../explore/destinations';
import { element } from '../../ui/dom';
import { uiIcon } from '../../ui/icons';
import './explorePanel.css';

const TOPIC_LABELS: Readonly<Record<Topic, string>> = {
  space: 'Space',
  earth: 'Earth',
  life: 'Life',
  people: 'People',
  climate: 'Climate',
};

/** The other panels on Explore's side, closed when it opens. */
const SAME_SIDE = 'dialog.layers-dialog[open]';

export interface ExplorePanel {
  readonly button: HTMLButtonElement;
  readonly dialog: HTMLDialogElement;
  /** Mark the destination the view was arrived at from, if any. */
  render(current: string | null): void;
}

export interface ExploreActions {
  readonly onDestination: (destination: Destination) => void;
  readonly onSearch: () => void;
  /** Whether the page is narrow, where the panel is a sheet over the globe. */
  readonly narrow: () => boolean;
}

function destinationCard(destination: Destination, open: () => void): HTMLElement {
  const go = element(
    'button',
    { type: 'button', class: 'explore-go', 'data-destination': destination.id },
    destination.label,
  );
  go.addEventListener('click', open);
  const questions = destination.questions.map((question) => {
    const ask = element('button', { type: 'button', class: 'explore-question' }, question);
    ask.addEventListener('click', open);
    return element('li', {}, ask);
  });
  return element(
    'li',
    { class: 'explore-item' },
    go,
    element('p', { class: 'explore-about' }, destination.description),
    element(
      'ul',
      { class: 'explore-questions', 'aria-label': 'Questions it answers' },
      ...questions,
    ),
  );
}

/** Where each key moves in the list of topics, from the one at `at`. */
const TOPIC_KEYS: Readonly<Record<string, (at: number) => number>> = {
  ArrowRight: (at) => (at + 1) % TOPICS.length,
  ArrowLeft: (at) => (at + TOPICS.length - 1) % TOPICS.length,
  Home: () => 0,
  End: () => TOPICS.length - 1,
};

interface TopicTabs {
  readonly root: HTMLElement;
  select(topic: Topic): void;
  focus(topic: Topic): void;
}

/** The topics as tabs: a click or the arrow keys pick one. */
function topicTabs(onTopic: (topic: Topic) => void): TopicTabs {
  const root = element('div', { class: 'explore-topics', role: 'tablist', 'aria-label': 'Topics' });
  const tabs = new Map<Topic, HTMLButtonElement>();
  let selected: Topic = 'space';
  for (const each of TOPICS) {
    const tab = element(
      'button',
      {
        type: 'button',
        role: 'tab',
        class: 'explore-topic',
        id: `explore-tab-${each}`,
        'aria-controls': 'explore-list',
      },
      TOPIC_LABELS[each],
    );
    tab.addEventListener('click', () => {
      onTopic(each);
    });
    tabs.set(each, tab);
    root.append(tab);
  }
  root.addEventListener('keydown', (event) => {
    const step = TOPIC_KEYS[event.key];
    const next = step === undefined ? undefined : TOPICS[step(TOPICS.indexOf(selected))];
    if (next === undefined) return;
    event.preventDefault();
    onTopic(next);
    tabs.get(next)?.focus();
  });
  return {
    root,
    select(topic) {
      selected = topic;
      for (const [each, tab] of tabs) {
        tab.setAttribute('aria-selected', String(each === topic));
        tab.tabIndex = each === topic ? 0 : -1;
      }
    },
    focus(topic) {
      tabs.get(topic)?.focus();
    },
  };
}

/** The panel's elements: its button in the header, and the dialog holding the topics. */
function panelElements(topics: HTMLElement) {
  const button = element(
    'button',
    {
      type: 'button',
      class: 'search-open explore-open',
      'aria-haspopup': 'dialog',
      'aria-expanded': 'false',
      'aria-controls': 'explore-panel',
    },
    uiIcon('explore', 16),
    element('span', { class: 'icon-label' }, 'Explore'),
  );
  const close = element(
    'button',
    { type: 'button', class: 'famous-close', 'aria-label': 'Close' },
    '×',
  );
  const list = element('ul', {
    class: 'explore-list',
    role: 'tabpanel',
    id: 'explore-list',
    tabindex: '-1',
  });
  const search = element(
    'button',
    { type: 'button', class: 'explore-search' },
    uiIcon('search', 16),
    'Search for a mission, place or record',
  );
  const dialog = element(
    'dialog',
    {
      id: 'explore-panel',
      class: 'famous-dialog explore-dialog',
      'aria-labelledby': 'explore-title',
    },
    element(
      'header',
      { class: 'famous-header' },
      element('h2', { id: 'explore-title' }, 'Explore'),
      close,
    ),
    topics,
    list,
    search,
  );
  return { button, close, list, search, dialog };
}

export function createExplorePanel(actions: ExploreActions): ExplorePanel {
  let topic: Topic = 'space';
  let current: string | null = null;
  const tabs = topicTabs((next) => {
    show(next);
  });
  const { button, close, list, search, dialog } = panelElements(tabs.root);

  function open(destination: Destination): void {
    actions.onDestination(destination);
    if (actions.narrow()) shut();
  }

  function show(next: Topic): void {
    topic = next;
    tabs.select(topic);
    list.setAttribute('aria-labelledby', `explore-tab-${topic}`);
    list.replaceChildren(
      ...destinationsIn(topic).map((destination) =>
        destinationCard(destination, () => {
          open(destination);
        }),
      ),
    );
    mark();
  }

  function mark(): void {
    for (const go of list.querySelectorAll<HTMLElement>('.explore-go')) {
      if (go.dataset['destination'] === current) go.setAttribute('aria-current', 'true');
      else go.removeAttribute('aria-current');
    }
  }

  function shut(): void {
    if (dialog.open) dialog.close();
  }
  button.addEventListener('click', () => {
    if (dialog.open) {
      shut();
      return;
    }
    for (const other of document.querySelectorAll<HTMLDialogElement>(SAME_SIDE)) other.close();
    // Open on the topic of the destination arrived from, if any.
    const at = DESTINATIONS.find((destination) => destination.id === current);
    show(at?.topics[0] ?? topic);
    dialog.show();
    button.setAttribute('aria-expanded', 'true');
    tabs.focus(topic);
  });
  close.addEventListener('click', shut);
  search.addEventListener('click', () => {
    shut();
    actions.onSearch();
  });
  dialog.addEventListener('close', () => {
    button.setAttribute('aria-expanded', 'false');
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    shut();
    button.focus();
  });
  show(topic);

  return {
    button,
    dialog,
    render(next) {
      if (next === current) return;
      current = next;
      mark();
    },
  };
}
