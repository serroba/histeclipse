// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Mesh } from 'three';

import type { Field } from '../../data/oceanCurrents';
import type { LayerHost } from '../../globe/layerHost';
import { flowLayer } from './flowLayer';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function still(): Field {
  const width = 361;
  const height = 181;
  return {
    width,
    height,
    u: new Float32Array(width * height).fill(0.5),
    v: new Float32Array(width * height).fill(0.1),
    bound: 1,
  };
}

describe('the currents drawn as streaks (#927)', () => {
  it('Given a field, Then the sphere shows and frames draw streaks; null stops and clears', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    const stroke = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke,
    } as unknown as CanvasRenderingContext2D);
    const added: Mesh[] = [];
    const container = document.createElement('div');
    const requestRender = vi.fn();
    const layer = flowLayer({
      container,
      onEarth: { add: (mesh: Mesh) => added.push(mesh) },
      requestRender,
    } as unknown as LayerHost);
    expect(added[0]?.visible).toBe(false);
    const field = still();
    layer.update(field);
    layer.update(field);
    expect(container.dataset['oceanCurrents']).toBe('on');
    expect(added[0]?.visible).toBe(true);
    expect(frames).toHaveLength(1);
    frames[0]?.(1000);
    frames[1]?.(1016);
    frames[2]?.(1032);
    expect(stroke).toHaveBeenCalled();
    expect(requestRender).toHaveBeenCalled();
    layer.update(null);
    expect(added[0]?.visible).toBe(false);
    expect(container.dataset['oceanCurrents']).toBe('off');
    const queued = frames.length;
    frames.at(-1)?.(1048);
    expect(frames).toHaveLength(queued);
  });

  it('Given a phone, Then a smaller canvas; and with no 2D canvas, Then nothing is drawn', () => {
    vi.stubGlobal('innerWidth', 400);
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const added: Mesh[] = [];
    const requestRender = vi.fn();
    const layer = flowLayer({
      container: document.createElement('div'),
      onEarth: { add: (mesh: Mesh) => added.push(mesh) },
      requestRender,
    } as unknown as LayerHost);
    layer.update(still());
    frames[0]?.(1000);
    expect(requestRender).not.toHaveBeenCalled();
    layer.update(null);
    expect(requestRender).toHaveBeenCalledTimes(1);
    const material = added[0]?.material as { map?: { image?: HTMLCanvasElement } } | undefined;
    expect(material?.map?.image?.width).toBe(1024);
  });

  it('Given slow frames, Then the next waits as long as the last took; turned off meanwhile, none comes', () => {
    vi.useFakeTimers();
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    let clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const layer = flowLayer({
      container: document.createElement('div'),
      onEarth: { add: () => undefined },
      requestRender: vi.fn(),
    } as unknown as LayerHost);
    layer.update(still());
    clock = 200; // the frame came 200 ms after it was asked for
    frames[0]?.(200);
    expect(frames).toHaveLength(1);
    vi.advanceTimersByTime(199);
    expect(frames).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(frames).toHaveLength(2);
    clock = 1000;
    frames[1]?.(1000);
    layer.update(null);
    vi.advanceTimersByTime(1000);
    expect(frames).toHaveLength(2);
    vi.useRealTimers();
  });
});
