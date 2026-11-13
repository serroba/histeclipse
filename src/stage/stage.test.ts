import { PerspectiveCamera } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Stage } from './stage';
import type { StageRenderer } from './stage';

/** Frames run by hand: `next(now)` runs the one asked for. */
let pending: ((now: number) => void) | null = null;
let observed: (() => void) | null = null;
const disconnect = vi.fn();

beforeEach(() => {
  pending = null;
  observed = null;
  vi.stubGlobal('requestAnimationFrame', (callback: (now: number) => void) => {
    pending = callback;
    return 7;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    pending = null;
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        observed = callback;
      }
      observe = vi.fn();
      disconnect = disconnect;
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function next(now: number): void {
  const run = pending;
  pending = null;
  run?.(now);
}

function fakes(width = 300, height = 200) {
  const renderer = {
    domElement: { canvas: true } as unknown as HTMLCanvasElement,
    setSize: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
  } satisfies StageRenderer;
  const append = vi.fn();
  const container = {
    append,
    clientWidth: width,
    clientHeight: height,
  } as unknown as HTMLElement;
  return { renderer, container, append };
}

function stage(styleSize = false, width = 300, height = 200) {
  const { renderer, container, append } = fakes(width, height);
  const made = new Stage(container, { renderer, camera: new PerspectiveCamera(), styleSize });
  return { made, renderer, append };
}

describe('Stage', () => {
  it('puts its canvas in the container', () => {
    const { renderer, append } = stage();
    expect(append).toHaveBeenCalledWith(renderer.domElement);
  });

  it('draws the first frame, then only when something changed', () => {
    const { made, renderer } = stage();
    made.start();
    next(1);
    next(2);
    expect(renderer.render).toHaveBeenCalledTimes(1);
    made.invalidate();
    next(3);
    expect(renderer.render).toHaveBeenCalledTimes(2);
  });

  it('draws when a part steps and says so, and calls the parts in order around the drawing', () => {
    const { made, renderer } = stage();
    const calls: string[] = [];
    let moving = false;
    renderer.render.mockImplementation(() => calls.push('render'));
    made.add({
      step: () => (calls.push('step a'), moving),
      beforeRender: () => (calls.push('before a'), undefined),
      afterRender: () => calls.push('after a'),
    });
    made.add({
      step: () => (calls.push('step b'), false),
      afterRender: () => calls.push('after b'),
    });
    made.start(true);
    expect(calls).toEqual(['step a', 'step b', 'before a', 'render', 'after a', 'after b']);
    calls.length = 0;
    next(2);
    expect(calls).toEqual(['step a', 'step b']);
    moving = true;
    next(3);
    expect(renderer.render).toHaveBeenCalledTimes(2);
  });

  it('draws again next frame when a part asks before a drawing', () => {
    const { made, renderer } = stage();
    let arriving = true;
    made.add({ beforeRender: () => arriving });
    made.start(true);
    arriving = false;
    next(2);
    next(3);
    expect(renderer.render).toHaveBeenCalledTimes(2);
  });

  it('stops and starts again, once', () => {
    const { made, renderer } = stage();
    made.start(true);
    made.start(true);
    expect(renderer.render).toHaveBeenCalledTimes(1);
    made.stop();
    expect(pending).toBeNull();
    made.start();
    made.invalidate();
    next(4);
    expect(renderer.render).toHaveBeenCalledTimes(2);
  });

  it('does not ask for another frame once stopped during one', () => {
    const { made } = stage();
    made.add({ afterRender: () => {
        made.stop();
      } });
    made.start(true);
    expect(pending).toBeNull();
  });

  it('sizes the canvas to its container and tells the parts', () => {
    const { made, renderer } = stage(false, 640, 480);
    const resize = vi.fn();
    made.add({ resize });
    made.observeResize();
    expect(renderer.setSize).toHaveBeenCalledWith(640, 480, false);
    expect(resize).toHaveBeenCalledWith(640, 480);
    observed?.();
    expect(renderer.setSize).toHaveBeenCalledTimes(2);
  });

  it('leaves a container with no size alone when it sets the CSS size', () => {
    const { made, renderer } = stage(true, 0, 480);
    made.resize();
    expect(renderer.setSize).not.toHaveBeenCalled();
    const sized = stage(true, 10, 20);
    sized.made.resize();
    expect(sized.renderer.setSize).toHaveBeenCalledWith(10, 20, true);
  });

  it('a resize asks for a drawing', () => {
    const { made, renderer } = stage();
    made.start(true);
    made.resize();
    next(2);
    expect(renderer.render).toHaveBeenCalledTimes(2);
  });

  it('lets go of everything on dispose', () => {
    const { made, renderer } = stage();
    const dispose = vi.fn();
    made.add({ dispose });
    made.add({});
    made.observeResize();
    made.start();
    made.dispose();
    expect(pending).toBeNull();
    expect(disconnect).toHaveBeenCalled();
    expect(dispose).toHaveBeenCalled();
    expect(renderer.dispose).toHaveBeenCalled();
    stage().made.dispose();
  });
});
