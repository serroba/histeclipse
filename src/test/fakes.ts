/**
 * Stand-ins for what unit tests do not have (#627): the page's elements, frames and resizing,
 * and a renderer. The parts of the 3D views take these where they would take the page, so their
 * logic can be tested without a browser. Imported by tests only, never by the app.
 */

import { Vector2, type WebGLRenderer } from 'three';
import { afterEach, beforeEach, type Mock, vi } from 'vitest';

/** An element as the parts use one: its text, whether it shows, where it is, its data. */
export interface FakeElement {
  className: string;
  textContent: string;
  hidden: boolean;
  readonly style: { transform?: string; color?: string };
  readonly dataset: Record<string, string>;
  readonly children: FakeElement[];
  /** Where it is on screen; a test sets it to say how names overlap. */
  box: { left: number; right: number; top: number; bottom: number };
  readonly append: (...children: FakeElement[]) => void;
  readonly remove: () => void;
  readonly getBoundingClientRect: () => DOMRect;
}

/** An element nothing has been done to yet. */
export function fakeElement(): FakeElement {
  const element: FakeElement = {
    className: '',
    textContent: '',
    hidden: false,
    style: {},
    dataset: {},
    children: [],
    box: { left: 0, right: 0, top: 0, bottom: 0 },
    append(...children) {
      element.children.push(...children);
    },
    remove: vi.fn(),
    getBoundingClientRect: () => ({ ...element.box }) as DOMRect,
  };
  return element;
}

/** What a test reads back of a fake page: every element made, in order. */
export interface FakePage {
  readonly made: FakeElement[];
  /** The element made with this text, if any. */
  readonly byText: (text: string) => FakeElement | undefined;
}

/**
 * Give the tests in this file a `document` whose elements are fakes, made anew for each test.
 * Call it at the top of a test file.
 */
export function useFakeDocument(): FakePage {
  const page: FakePage = {
    made: [],
    byText: (text) => page.made.find((element) => element.textContent === text),
  };
  beforeEach(() => {
    page.made.length = 0;
    vi.stubGlobal('document', {
      createElement: () => {
        const element = fakeElement();
        page.made.push(element);
        return element;
      },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  return page;
}

/** A container: where a view's canvas and layers go, of a size. */
export function fakeContainer(width = 300, height = 200): HTMLElement & FakeElement {
  return Object.assign(fakeElement(), {
    clientWidth: width,
    clientHeight: height,
  }) as unknown as HTMLElement & FakeElement;
}

/** The sky's projection uniforms, at rest. */
export function projectionUniforms(): {
  skyScale: { value: Vector2 };
  skyShift: { value: Vector2 };
  skyClip: { value: number };
  skyViewport: { value: Vector2 };
} {
  return {
    skyScale: { value: new Vector2(1, 1) },
    skyShift: { value: new Vector2() },
    skyClip: { value: 0 },
    skyViewport: { value: new Vector2(1, 1) },
  };
}

/** A renderer as the Stage uses one, each call recorded. */
export interface FakeRenderer {
  readonly domElement: HTMLCanvasElement;
  readonly setSize: Mock<WebGLRenderer['setSize']>;
  readonly render: Mock<WebGLRenderer['render']>;
  readonly dispose: Mock<WebGLRenderer['dispose']>;
}

/** A renderer as the Stage uses one: what it was asked to do is recorded. */
export function fakeRenderer(): FakeRenderer {
  return {
    domElement: fakeElement() as unknown as HTMLCanvasElement,
    setSize: vi.fn<WebGLRenderer['setSize']>(),
    render: vi.fn<WebGLRenderer['render']>(),
    dispose: vi.fn<WebGLRenderer['dispose']>(),
  };
}

/** Animation frames and resizing, run by hand. */
export interface ManualFrames {
  /** Run the frame asked for, at `now`; nothing if none was asked for. */
  next(now: number): void;
  /** Whether a frame is waiting. */
  pending(): boolean;
  /** Tell the resize observers their element changed size. */
  resize(): void;
  /** How many times an observer was disconnected. */
  disconnected(): number;
}

/**
 * Give the tests in this file `requestAnimationFrame` and `ResizeObserver` run by hand. Call it
 * at the top of a test file.
 */
export function useManualFrames(): ManualFrames {
  let waiting: ((now: number) => void) | null = null;
  let observers: (() => void)[] = [];
  let disconnects = 0;
  beforeEach(() => {
    waiting = null;
    observers = [];
    disconnects = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: (now: number) => void) => {
      waiting = callback;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {
      waiting = null;
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          observers.push(callback);
        }
        observe = vi.fn();
        disconnect = (): void => {
          disconnects++;
        };
      },
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  return {
    next(now) {
      const run = waiting;
      waiting = null;
      run?.(now);
    },
    pending: () => waiting !== null,
    resize() {
      for (const observer of observers) observer();
    },
    disconnected: () => disconnects,
  };
}
