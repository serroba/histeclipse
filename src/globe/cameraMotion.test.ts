import { PerspectiveCamera } from 'three';
import { describe, expect, it, vi } from 'vitest';

import { CameraMotion, SETTLE_MS } from './cameraMotion';

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

describe('CameraMotion.settlesIn', () => {
  it('waits SETTLE_MS from the last move, counting down while still', () => {
    const motion = new CameraMotion();
    const looking = camera();
    expect(motion.settlesIn(looking, 1000)).toBe(SETTLE_MS);
    expect(motion.settlesIn(looking, 1050)).toBe(SETTLE_MS - 50);
    expect(motion.settlesIn(looking, 1000 + SETTLE_MS)).toBe(0);
    expect(motion.settlesIn(looking, 5000)).toBe(0);
  });

  it('starts again from a move made before it settled', () => {
    const motion = new CameraMotion();
    const looking = camera();
    motion.settlesIn(looking, 0);
    looking.position.x += 1;
    looking.updateMatrixWorld();
    expect(motion.settlesIn(looking, 150)).toBe(SETTLE_MS);
    expect(motion.settlesIn(looking, 300)).toBe(SETTLE_MS - 150);
  });
});

describe('CameraMotion.turning', () => {
  it('turns while moving, and wakes once, when it has settled', () => {
    vi.useFakeTimers();
    try {
      const wake = vi.fn();
      const motion = new CameraMotion(wake);
      const looking = camera();
      expect(motion.turning(looking, 0)).toBe(true);
      looking.position.x += 1;
      looking.updateMatrixWorld();
      expect(motion.turning(looking, 100)).toBe(true);
      vi.advanceTimersByTime(SETTLE_MS - 1);
      expect(wake).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(wake).toHaveBeenCalledTimes(1);
      expect(motion.turning(looking, 100 + SETTLE_MS)).toBe(false);
      vi.advanceTimersByTime(SETTLE_MS * 2);
      expect(wake).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('wakes no more once disposed', () => {
    vi.useFakeTimers();
    try {
      const wake = vi.fn();
      const motion = new CameraMotion(wake);
      motion.turning(camera(), 0);
      motion.dispose();
      vi.advanceTimersByTime(SETTLE_MS);
      expect(wake).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
