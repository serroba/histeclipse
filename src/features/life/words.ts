/** Words the animals' stories share: a lineage's plain name, and names in a list. */

import type { LifeNode } from '../../data/lifeStories';

/** A lineage's name as a reader knows it: its common name where PBDB has one, else its own. */
export function plainName(node: LifeNode): string {
  return node.common === '' ? node.name : node.common;
}

/** "North America", "North America and Asia", "North America, Asia and Africa". */
export function listed(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`;
}

/** A count with its noun: "1 kind", "3 kinds". */
export function counted(count: number, one: string): string {
  return `${String(count)} ${one}${count === 1 ? '' : 's'}`;
}

/** "Lion" for "lion". */
export function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
