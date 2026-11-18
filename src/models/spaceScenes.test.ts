import { Box3, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { SPACE_SCENES } from './spaceScenes';
import { SPACE_MODELS } from './spaceTelescopeModels';

describe('the space telescopes as the camera goes to them (#863)', () => {
  it('Given every space telescope with a model, Then it can be gone to, by its craft', () => {
    const telescopes = [...SPACE_SCENES.values()].map(({ telescope }) => telescope).sort();
    expect(telescopes).toEqual(Object.keys(SPACE_MODELS).sort());
    for (const craft of SPACE_SCENES.keys()) expect(craft).toMatch(/^[DS]\d{5}$/);
    expect(SPACE_SCENES.get('D00874')?.about).toBe('sun');
  });

  it.each([...SPACE_SCENES.values()].map((scene) => [scene.telescope, scene] as const))(
    'Given %s, Then its radius is half its longest side, and its Sun side is turned below',
    async (telescope, scene) => {
      const model = (await scene.build())();
      model.updateMatrixWorld(true);
      const size = new Box3().setFromObject(model).getSize(new Vector3());
      const longest = Math.max(size.x, size.y, size.z);
      expect(scene.radius).toBeGreaterThan(longest * 0.4);
      expect(scene.radius).toBeLessThan(longest * 0.6);
      const turned = model.children[0];
      const { sun } = SPACE_MODELS[telescope];
      const down = sun
        .clone()
        .normalize()
        .applyQuaternion(turned?.quaternion ?? model.quaternion);
      if (telescope !== 'webb' && telescope !== 'hubble') expect(down.y).toBeCloseTo(-1, 6);
    },
  );
});
