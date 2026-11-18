// @vitest-environment happy-dom
import { BoxGeometry, Mesh, MeshPhongMaterial, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';

import { mountModelView, type ModelRenderer } from './modelView';

interface StandIn {
  readonly renderer: ModelRenderer;
  readonly sized: ReturnType<typeof vi.fn>;
  readonly disposed: ReturnType<typeof vi.fn>;
  readonly lost: ReturnType<typeof vi.fn>;
  loop: (() => void) | null;
  renders: number;
}

function standIn(): StandIn {
  const sized = vi.fn();
  const disposed = vi.fn();
  const lost = vi.fn();
  const fake: StandIn = {
    sized,
    disposed,
    lost,
    loop: null,
    renders: 0,
    renderer: {
      domElement: document.createElement('canvas'),
      setPixelRatio: () => undefined,
      setSize: sized,
      setAnimationLoop: (loop) => {
        fake.loop = loop;
      },
      render: () => {
        fake.renders += 1;
      },
      dispose: disposed,
      forceContextLoss: lost,
    },
  };
  return fake;
}

function box(): Mesh<BoxGeometry, MeshPhongMaterial> {
  return new Mesh(new BoxGeometry(10, 4, 20), new MeshPhongMaterial());
}

describe('a craft’s model in its card (#797)', () => {
  it('Given a model, When it is mounted and a frame drawn, Then its canvas is in the box and marked drawn', () => {
    const host = document.createElement('div');
    const fake = standIn();
    mountModelView(host, box(), { sun: new Vector3(0, -1, 0), renderer: () => fake.renderer });
    expect(host.querySelector('[data-testid="craft-model"]')).toBe(fake.renderer.domElement);
    expect(fake.sized).toHaveBeenCalledWith(160, 99, true);
    expect(host.hasAttribute('data-drawn')).toBe(false);
    fake.loop?.();
    fake.loop?.();
    expect(fake.renders).toBe(2);
    expect(host.getAttribute('data-drawn')).toBe('true');
  });

  it('Given it is stopped, Then the loop ends, the canvas goes and the model’s parts are let go', () => {
    const host = document.createElement('div');
    const fake = standIn();
    const model = box();
    const dropped = vi.spyOn(model.geometry, 'dispose');
    const faded = vi.spyOn(model.material, 'dispose');
    const stop = mountModelView(host, model, {
      sun: new Vector3(0, -1, 0),
      stillness: true,
      renderer: () => fake.renderer,
    });
    stop();
    expect(fake.loop).toBeNull();
    expect(host.querySelector('canvas')).toBeNull();
    expect(dropped).toHaveBeenCalled();
    expect(faded).toHaveBeenCalled();
    expect(fake.disposed).toHaveBeenCalled();
    expect(fake.lost).toHaveBeenCalled();
  });

  it('Given a browser without WebGL, Then it says so and stopping does nothing', () => {
    const host = document.createElement('div');
    const stop = mountModelView(host, box(), {
      sun: new Vector3(0, -1, 0),
      renderer: () => {
        throw new Error('no WebGL');
      },
    });
    expect(host.textContent).toBe('This browser could not draw the model.');
    expect(() => {
      stop();
    }).not.toThrow();
  });
});
