/**
 * The keys every animation answers: Space plays or pauses, the left and right arrows step back
 * and on (ten steps with Shift). Each thing that plays joins in once, and the keys go to the one
 * the reader is at: the one holding the focus, else one laid over the page (a sheet, a story),
 * else the one on the page. A key that a control of its own would use is left to that control:
 * the arrows in a field or on a slider move there, and Space is typed in a field and presses a
 * button the reader has come to by the keyboard (one only clicked, or focused by a sheet as it
 * opened, lets Space through: it is the animation the reader means).
 *
 * What a key does and who it goes to are pure, tested; the listener only applies them.
 */

/** Something that plays, as the keys see it. */
export interface KeyPlayer {
  /** Whether it is there to be played. */
  shown(): boolean;
  /** Whether the focus is within it. */
  holds?(focus: Element): boolean;
  /** Play, or pause. */
  toggle(): void;
  /** A step back (-1) or on (1); `leap` asks for a longer one. */
  step(direction: -1 | 1, leap: boolean): void;
  /** Whether it lies over the page, and so comes before what is on the page. */
  readonly over?: boolean;
}

type PlayKey = 'toggle' | 'back' | 'on' | null;

interface PlayKeyPress {
  readonly key: string;
  /** Ctrl, Meta or Alt held: the browser's own, or another shortcut's. */
  readonly modified: boolean;
  /** The key held down, repeating. */
  readonly repeat: boolean;
  /** Whether what has the focus presses itself on Space, or takes the arrows for itself. */
  readonly takesSpace: boolean;
  readonly takesArrows: boolean;
}

/** What a key asks of what plays; null leaves it to the page. */
export function playKey(press: PlayKeyPress): PlayKey {
  if (press.modified) return null;
  // Held down, Space would play and pause many times a second.
  if (press.key === ' ') return press.takesSpace || press.repeat ? null : 'toggle';
  if (press.takesArrows) return null;
  if (press.key === 'ArrowLeft') return 'back';
  return press.key === 'ArrowRight' ? 'on' : null;
}

/** Where Space is typed. */
const TYPES_SPACE =
  'textarea, input:not([type="range"], [type="checkbox"], [type="radio"], [type="button"], [type="submit"]), [contenteditable]:not([contenteditable="false"])';
/** What Space presses, once the reader has come to it by the keyboard. */
const PRESSED_BY_SPACE =
  'button, a[href], summary, select, input, [role="button"], [role="tab"], [role="checkbox"], [role="switch"], [role="option"], [role="menuitem"]';

/**
 * Whether Space on `target` is its own: typed there, or pressing what the reader came to by the
 * keyboard (`reached`). A button just clicked, or one a sheet focused as it opened, is not.
 */
function takesSpace(target: Element, reached: boolean): boolean {
  if (target.closest(TYPES_SPACE) !== null) return true;
  return reached && target.matches(PRESSED_BY_SPACE);
}

/** What the arrows already move within. */
const TAKES_ARROWS =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="tab"], [role="tablist"], [role="radio"], [role="listbox"], [role="menu"]';

/**
 * The one the keys go to, of those shown: null when nothing plays. Under a `modal` dialog only
 * one holding the focus, which the dialog keeps: what plays behind it is out of reach.
 */
export function playerFor(
  players: readonly KeyPlayer[],
  focus: Element | null,
  modal = false,
): KeyPlayer | null {
  const shown = players.filter((player) => player.shown());
  const held = focus === null ? undefined : shown.find((player) => player.holds?.(focus) === true);
  if (modal) return held ?? null;
  // Of those over the page, and of those on it, the one that joined last.
  return held ?? shown.findLast((player) => player.over === true) ?? shown.at(-1) ?? null;
}

export interface PlayKeys {
  /** Join in; the returned function leaves. */
  add(player: KeyPlayer): () => void;
}

/** The keys of `page`, listened for once the first player joins. */
function createPlayKeys(
  page: Pick<Document, 'addEventListener' | 'activeElement' | 'querySelector'>,
): PlayKeys {
  const players: KeyPlayer[] = [];
  let listening = false;
  // How the focus came to where it is: by a key (Tab, or Enter on what opened a sheet) or not.
  // The browser's own :focus-visible cannot say: any key pressed turns it on.
  let lastInput: 'key' | 'pointer' | null = null;
  let reached = false;

  function onKey(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.isComposing) return;
    const target = event.target instanceof Element ? event.target : null;
    const action = playKey({
      key: event.key,
      modified: event.ctrlKey || event.metaKey || event.altKey,
      repeat: event.repeat,
      takesSpace: target !== null && takesSpace(target, reached),
      takesArrows: target !== null && target.closest(TAKES_ARROWS) !== null,
    });
    if (action === null) return;
    const modal = page.querySelector('dialog:modal') !== null;
    const player = playerFor(players, target ?? page.activeElement, modal);
    if (player === null) return;
    // Space would scroll the page, too.
    event.preventDefault();
    if (action === 'toggle') player.toggle();
    else player.step(action === 'back' ? -1 : 1, event.shiftKey);
  }

  return {
    add(player) {
      players.push(player);
      if (!listening) {
        listening = true;
        page.addEventListener('keydown', onKey);
        page.addEventListener('keydown', () => (lastInput = 'key'), true);
        page.addEventListener('pointerdown', () => (lastInput = 'pointer'), true);
        page.addEventListener('focusin', () => (reached = lastInput === 'key'));
      }
      return () => {
        const at = players.indexOf(player);
        if (at >= 0) players.splice(at, 1);
      };
    },
  };
}

let pageKeys: PlayKeys | null = null;

/** The page's keys, which everything that plays joins. */
export const playKeys: PlayKeys = {
  add(player) {
    pageKeys ??= createPlayKeys(document);
    return pageKeys.add(player);
  },
};
