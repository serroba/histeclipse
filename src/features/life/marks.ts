/**
 * What an animal's story marks on the globe at a moment: each site of the step, the picked
 * kind's and the newly found kinds' told apart; and, a step after a kind's last finds, where it
 * was last seen.
 */

import type { LifeNode, LifeSite } from '../../data/lifeStories';
import { stepAt, type Kind, type Story } from './story';

type MarkKind = 'focus' | 'began' | 'found' | 'ended';

/** A site to mark on the globe at a moment. */
export interface Mark {
  readonly latitude: number;
  readonly longitude: number;
  readonly finds: number;
  readonly kind: MarkKind;
  /** Whether this is the kind's site with the most finds in the step: its picture points at it. */
  readonly lead: boolean;
  readonly title: string;
  /** The kind found here, and the site itself. */
  readonly node: LifeNode;
  readonly site: LifeSite;
}

const MARK_ORDER: Readonly<Record<MarkKind, number>> = { focus: 0, began: 1, ended: 2, found: 3 };

/** How a kind's sites of a step are marked. */
function stateOf(story: Story, kind: Kind, step: number): MarkKind {
  // In the last step, a kind that is not living is one lost since.
  if (step === 0 && kind.last === 0 && !kind.node.living) return 'ended';
  if (kind.node.index === story.focus?.index) return 'focus';
  return kind.first === step ? 'began' : 'found';
}

const SAID: Readonly<Record<MarkKind, string>> = {
  focus: '',
  found: '',
  began: ', its oldest',
  ended: ', among its last',
};

function markOf(kind: Kind, site: LifeSite, at: number, state: MarkKind, title: string): Mark {
  return {
    latitude: site.latitude,
    longitude: site.longitude,
    finds: site.finds,
    kind: state,
    lead: at === 0,
    node: kind.node,
    site,
    title,
  };
}

/** A kind's marks at a step: its sites then, or a step on from its last, where it was last seen. */
function marksOf(story: Story, kind: Kind, step: number): Mark[] {
  const state = stateOf(story, kind, step);
  const now = (kind.at.get(step) ?? []).map((site, at) =>
    markOf(
      kind,
      site,
      at,
      state,
      `${kind.node.name}: ${String(site.finds)} ${site.finds === 1 ? 'find' : 'finds'}${SAID[state]}`,
    ),
  );
  if (kind.node.living || kind.last !== step + story.data.stepMa) return now;
  const last = (kind.at.get(kind.last) ?? []).map((site, at) =>
    markOf(
      kind,
      site,
      at,
      'ended',
      `${kind.node.name}: last found here, ${String(kind.last)} million years ago`,
    ),
  );
  return [...now, ...last];
}

/** What to mark at a moment: the `most` sites with the most to say, the most telling first. */
export function marksAt(story: Story, ma: number, most = 220): readonly Mark[] {
  const step = stepAt(story, ma);
  return story.members
    .flatMap((kind) => marksOf(story, kind, step))
    .sort((a, b) => MARK_ORDER[a.kind] - MARK_ORDER[b.kind] || b.finds - a.finds)
    .slice(0, most);
}
