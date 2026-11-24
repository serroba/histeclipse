// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { setHidden, setText } from './pageWrites';

/** A paragraph holding `text`, if any. */
function paragraph(text?: string): HTMLParagraphElement {
  const node = document.createElement('p');
  if (text !== undefined) node.append(text);
  return node;
}

/** The mutations `change` makes to `node` and below it. */
function mutations(node: Node, change: () => void): MutationRecord[] {
  const observer = new MutationObserver(() => undefined);
  observer.observe(node, { attributes: true, childList: true, characterData: true, subtree: true });
  change();
  const records = observer.takeRecords();
  observer.disconnect();
  return records;
}

describe('writing to the page only what changed (#1187)', () => {
  it('sets text in its text node, and leaves the same text alone', () => {
    const node = paragraph('one');
    const text = node.firstChild;
    expect(
      mutations(node, () => {
        setText(node, 'one');
      }),
    ).toEqual([]);
    const changed = mutations(node, () => {
      setText(node, 'two');
    });
    expect(node.textContent).toBe('two');
    // The same node, its words changed: no node taken out or put in.
    expect(node.firstChild).toBe(text);
    expect(changed.map((record) => record.type)).toEqual(['characterData']);
  });

  it('sets the text of an empty node, or of one holding more than words', () => {
    const empty = paragraph();
    setText(empty, 'now');
    expect(empty.textContent).toBe('now');
    const mixed = paragraph('a ');
    mixed.append(document.createElement('b'));
    setText(mixed, 'plain');
    expect(mixed.innerHTML).toBe('plain');
  });

  it('hides and shows, and leaves it alone when it already is', () => {
    const node = document.createElement('div');
    expect(
      mutations(node, () => {
        setHidden(node, false);
      }),
    ).toEqual([]);
    setHidden(node, true);
    expect(node.hidden).toBe(true);
    expect(
      mutations(node, () => {
        setHidden(node, true);
      }),
    ).toEqual([]);
    setHidden(node, false);
    expect(node.hidden).toBe(false);
  });
});
