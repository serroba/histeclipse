import { PerspectiveCamera } from 'three';
import { describe, expect, it } from 'vitest';

import { CameraMotion } from './cameraMotion';

function camera(): PerspectiveCamera {
  const made = new PerspectiveCamera(40, 1, 0.1, 100);
  made.position.set(0, 0, 3);
  made.updateMatrixWorld();
  return made;
}

describe('CameraMotion', () => {
  it('counts the first look as a move', () => {
    expect(new CameraMotion().moved(camera())).toBe(true);
  });

  it('is still while the camera stays put', () => {
    const motion = new CameraMotion();
    const looking = camera();
    motion.moved(looking);
    expect(motion.moved(looking)).toBe(false);
  });

  it('sees the camera moved, then still again', () => {
    const motion = new CameraMotion();
    const looking = camera();
    motion.moved(looking);
    looking.position.set(1, 0, 3);
    looking.updateMatrixWorld();
    expect(motion.moved(looking)).toBe(true);
    expect(motion.moved(looking)).toBe(false);
  });

  it('counts a move far under a pixel as still: damping eases on without end', () => {
    const motion = new CameraMotion();
    const looking = camera();
    motion.moved(looking);
    looking.position.x += 1e-9;
    looking.updateMatrixWorld();
    expect(motion.moved(looking)).toBe(false);
  });

  it('sees the camera turned', () => {
    const motion = new CameraMotion();
    const looking = camera();
    motion.moved(looking);
    looking.rotation.y = 0.1;
    looking.updateMatrixWorld();
    expect(motion.moved(looking)).toBe(true);
  });

  it('sees the view widened or narrowed', () => {
    const motion = new CameraMotion();
    const looking = camera();
    motion.moved(looking);
    looking.fov = 30;
    looking.updateProjectionMatrix();
    expect(motion.moved(looking)).toBe(true);
  });
});
