// @vitest-environment happy-dom
import { Object3D } from 'three';
import { describe, expect, it, vi } from 'vitest';

const mountModelView = vi.fn<(host: HTMLElement, model: Object3D) => () => void>(
  () => () => undefined,
);
vi.mock('./modelView', () => ({ mountModelView }));

const { telescopeModel } = await import('./telescopeModels');

const GROUND = [
  'lovell',
  'parkes',
  'arecibo',
  'fast',
  'vla',
  'alma',
  'ska-mid',
  'ska-low',
  'hale',
  'hooker',
  'yerkes',
  'herschel-forty-foot',
  'leviathan',
  'keck',
  'subaru',
  'vlt',
  'gtc',
  'rubin',
  'elt',
];

const SPACE = [
  'webb',
  'hubble',
  'planck',
  'wmap',
  'gaia',
  'kepler',
  'spitzer',
  'cobe',
  'herschel-space',
  'tess',
  'iras',
  'hipparcos',
  'euclid',
];

describe('the telescopes’ models in their cards (#859, #860)', () => {
  it('Given a telescope on the ground, Then it has a model, the same each time, its caption saying what is by eye', () => {
    for (const id of GROUND) {
      const model = telescopeModel(id);
      expect(model).toBe(telescopeModel(id));
      expect(model?.label).toContain('in 3D');
      expect(model?.caption).toContain('by eye');
    }
    expect(telescopeModel('chandra')).toBeUndefined();
    for (const id of SPACE) expect(telescopeModel(id)?.label).toContain('in 3D');
  });

  it('Given each is shown, Then its own model is built and mounted', async () => {
    for (const id of [...GROUND, ...SPACE])
      telescopeModel(id)?.mount(document.createElement('div'));
    await vi.waitFor(() => {
      expect(mountModelView).toHaveBeenCalledTimes(GROUND.length + SPACE.length);
    });
    const built = mountModelView.mock.calls.map(([, model]) => model);
    expect(built.every((model) => model instanceof Object3D)).toBe(true);
    expect(new Set(built).size).toBe(GROUND.length + SPACE.length);
  });
});
