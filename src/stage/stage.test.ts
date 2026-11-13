import { PerspectiveCamera } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { fakeContainer, fakeRenderer, useManualFrames } from '../test/fakes';
import { Stage } from './stage';

const frames = useManualFrames();
const next = (now: number): void => {
  frames.next(now);
};

function stage(styleSize = false, width = 300, height = 200) {
  const renderer = fakeRenderer();
  const container = fakeContainer(width, height);
  const made = new Stage(container, { renderer, camera: new PerspectiveCamera(), styleSize });
  return { made, renderer, container };
}

describe('Stage', () => {
  it('puts its canvas in the container', () => {
    const { renderer, container } = stage();
    expect(container.children).toEqual([renderer.domElement]);
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
    expect(frames.pending()).toBe(false);
    made.start();
    made.invalidate();
    next(4);
    expect(renderer.render).toHaveBeenCalledTimes(2);
  });

  it('does not ask for another frame once stopped during one', () => {
    const { made } = stage();
    made.add({
      afterRender: () => {
        made.stop();
      },
    });
    made.start(true);
    expect(frames.pending()).toBe(false);
  });

  it('sizes the canvas to its container and tells the parts', () => {
    const { made, renderer } = stage(false, 640, 480);
    const resize = vi.fn();
    made.add({ resize });
    made.observeResize();
    expect(renderer.setSize).not.toHaveBeenCalled();
    frames.resize();
    expect(renderer.setSize).toHaveBeenCalledWith(640, 480, false);
    expect(resize).toHaveBeenCalledWith(640, 480);
    made.resize();
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
    expect(frames.pending()).toBe(false);
    expect(frames.disconnected()).toBe(1);
    expect(dispose).toHaveBeenCalled();
    expect(renderer.dispose).toHaveBeenCalled();
    stage().made.dispose();
  });
});
