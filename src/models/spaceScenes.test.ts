import { Box3, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { CATALOGUE } from './catalogue';
import { KEPT_TO_THE_SUN, type SpaceEntry } from './catalogueEntry';
import { SPACE_SCENES } from './spaceScenes';
import { telescopeModel } from './telescopeModels';

const SPACE = CATALOGUE.filter((entry): entry is SpaceEntry => entry.kind === 'space');

describe('the space telescopes as the camera goes to them (#863)', () => {
  it('Given every space telescope with a model, Then it can be gone to, by its craft', () => {
    const telescopes = [...SPACE_SCENES.values()].map(({ telescope }) => telescope).sort();
    expect(telescopes).toEqual(SPACE.map(({ id }) => id).sort());
    for (const craft of SPACE_SCENES.keys()) expect(craft).toMatch(/^[DS]\d{5}$/);
    expect(SPACE_SCENES.get('D00874')?.about).toBe('sun');
  });

  it('Given a craft’s card, Then its model is its telescope’s, and it says how it is drawn pointing', () => {
    for (const scene of SPACE_SCENES.values()) {
      expect(scene.card).toBe(telescopeModel(scene.telescope));
      expect(scene.pointing).toContain('a convention');
    }
    expect(SPACE_SCENES.get('D00874')?.pointing).toBe(KEPT_TO_THE_SUN);
    expect(SPACE_SCENES.get('D01093')?.pointing).toContain('sunshield');
  });

  it.each(SPACE.map((entry) => [entry.id, entry] as const))(
    'Given %s, Then its radius is half its longest side, and its Sun side is turned below',
    async (_, entry) => {
      const scene = SPACE_SCENES.get(entry.craft);
      const model = (await scene?.build())?.();
      if (scene === undefined || model === undefined) throw new Error('no scene');
      model.updateMatrixWorld(true);
      const size = new Box3().setFromObject(model).getSize(new Vector3());
      const longest = Math.max(size.x, size.y, size.z);
      expect(scene.radius).toBeGreaterThan(longest * 0.4);
      expect(scene.radius).toBeLessThan(longest * 0.6);
      const turned = model.children[0] ?? model;
      const down = (entry.sceneSun ?? entry.sun)
        .clone()
        .normalize()
        .applyQuaternion(turned.quaternion);
      expect(down.y).toBeCloseTo(-1, 6);
    },
  );
});
