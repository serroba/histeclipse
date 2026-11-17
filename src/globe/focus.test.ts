import { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';

import { BODY_RADIUS } from './bodyRadius';
import { craftFocus, focusFrames, focusOf, isCraft, nearest, nearPlane } from './focus';

const moon = { position: new Vector3(60, 0, 0), rotation: new Quaternion() };
const webb = {
  id: 'd01093',
  about: 'earth' as const,
  position: new Vector3(0, 0, 235),
  rotation: new Quaternion(),
  radius: 1.66e-6,
};

function frames(moved?: (move: () => void) => void) {
  return focusFrames(
    {
      frame: (body) =>
        body === 'moon' ? moon : { position: new Vector3(), rotation: new Quaternion() },
      ready: (body) => body !== 'saturn',
    },
    moved,
  );
}

describe('what the camera centres on (#796)', () => {
  it('Given a view, Then its focus is the craft named, else the body', () => {
    expect(focusOf({ focus: 'moon', craft: null })).toBe('moon');
    expect(focusOf({ focus: 'earth', craft: 'd01093' })).toBe('craft:d01093');
    expect(craftFocus('S20580')).toBe('craft:s20580');
    expect(isCraft('craft:d01093')).toBe(true);
    expect(isCraft('mars')).toBe(false);
  });

  it('Given a body, Then its frame, readiness, radius and body are its own', () => {
    const all = frames();
    expect(all.frame('moon')).toBe(moon);
    expect(all.ready('saturn')).toBe(false);
    expect(all.radius('sun')).toBe(BODY_RADIUS.sun);
    expect(all.body('mars')).toBe('mars');
  });

  it('Given a craft not held, Then it is not ready, and stands in as Earth', () => {
    const all = frames();
    expect(all.ready('craft:d01093')).toBe(false);
    expect(all.frame('craft:d01093').position.length()).toBe(0);
    expect(all.radius('craft:d01093')).toBe(1);
    expect(all.body('craft:d01093')).toBe('earth');
  });

  it('Given a craft held, Then it is ready where it is, at its size; another craft is not', () => {
    const moved = vi.fn((move: () => void) => {
      move();
    });
    const all = frames(moved);
    all.hold(webb);
    expect(moved).toHaveBeenCalledOnce();
    expect(all.ready('craft:d01093')).toBe(true);
    expect(all.frame('craft:d01093')).toBe(webb);
    expect(all.radius('craft:d01093')).toBe(1.66e-6);
    expect(all.ready('craft:s20580')).toBe(false);
    all.hold(null);
    expect(all.ready('craft:d01093')).toBe(false);
  });

  it('Given a craft, Then the camera comes just clear of it; Earth with tiles, nearest of the bodies', () => {
    expect(nearest('craft:d01093', false)).toBe(1.3);
    expect(nearest('earth', true)).toBeLessThan(nearest('earth', false));
  });

  it('Given the camera metres from a craft, Then the near plane comes in; far, it stays the scene’s', () => {
    const camera = new PerspectiveCamera(35, 1, 1e-4, 1e6);
    const project = vi.spyOn(camera, 'updateProjectionMatrix');
    nearPlane(camera, 3);
    expect(camera.near).toBe(1e-4);
    expect(project).not.toHaveBeenCalled();
    nearPlane(camera, 6e-6);
    expect(camera.near).toBeCloseTo(1.2e-7, 12);
    // A little closer or further changes nothing.
    nearPlane(camera, 7e-6);
    expect(project).toHaveBeenCalledOnce();
    nearPlane(camera, 0);
    expect(camera.near).toBeCloseTo(1.2e-7, 12);
  });
});
