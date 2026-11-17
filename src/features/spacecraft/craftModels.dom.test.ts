// @vitest-environment happy-dom
import { Group, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';

import { lazyModel, modelOf, sceneModelOf } from './craftModels';

describe('the craft with models (#797)', () => {
  it('Given Webb and Hubble, Then each has a model, the same each time; other craft have none', () => {
    expect(modelOf('D01093')).toBeDefined();
    expect(modelOf('D01093')).toBe(modelOf('D01093'));
    expect(modelOf('S20580')?.label).toContain('Hubble Space Telescope in 3D');
    expect(modelOf('D00273')).toBeUndefined();
  });

  it('Given its parts have come, Then it is mounted, and stopping stops it', async () => {
    const stop = vi.fn();
    const mountModelView = vi.fn(() => stop);
    const made = lazyModel('l', 'c', new Vector3(0, -1, 0), () =>
      Promise.resolve({ mountModelView, build: () => new Group() }),
    );
    const host = document.createElement('div');
    const end = made.mount(host);
    await vi.waitFor(() => {
      expect(mountModelView).toHaveBeenCalledOnce();
    });
    end();
    expect(stop).toHaveBeenCalledOnce();
  });

  it('Given the card closed before its parts came, Then it is never drawn', async () => {
    const mountModelView = vi.fn(() => () => undefined);
    let arrive: () => void = () => undefined;
    const made = lazyModel(
      'l',
      'c',
      new Vector3(0, -1, 0),
      () =>
        new Promise((resolve) => {
          arrive = () => {
            resolve({ mountModelView, build: () => new Group() });
          };
        }),
    );
    made.mount(document.createElement('div'))();
    arrive();
    await Promise.resolve();
    await Promise.resolve();
    expect(mountModelView).not.toHaveBeenCalled();
  });

  it('Given its parts could not be loaded, Then the box says so', async () => {
    const made = lazyModel('l', 'c', new Vector3(0, -1, 0), () =>
      Promise.reject(new Error('offline')),
    );
    const host = document.createElement('div');
    made.mount(host);
    await vi.waitFor(() => {
      expect(host.textContent).toBe('The model could not be loaded.');
    });
  });

  it.each(['D01093', 'S20580'])('Given %s’s own parts, Then they load and draw it', async (id) => {
    const host = document.createElement('div');
    // happy-dom has no WebGL: the view says so, which shows the real parts were loaded.
    const stop = modelOf(id)?.mount(host);
    await vi.waitFor(
      () => {
        expect(host.textContent).toBe('This browser could not draw the model.');
      },
      { timeout: 5000 },
    );
    stop?.();
  });

  it.each(['d01093', 's20580'])(
    'Given %s in the scene, Then its parts load and build it',
    async (id) => {
      const build = await sceneModelOf(id)?.load();
      expect(build?.().children.length).toBeGreaterThan(2);
    },
  );
});
