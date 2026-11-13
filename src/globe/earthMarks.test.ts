import { Sprite, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createSpinAxis, PlacePin } from './earthMarks';

// The poles' labels are drawn on a canvas: not in unit tests.
vi.mock('./labelTexture', () => ({ labelTexture: () => new Texture() }));

describe('PlacePin', () => {
  it('is hidden with no place, and says so', () => {
    const dataset: DOMStringMap = {};
    const pin = new PlacePin(dataset);
    expect(pin.mesh.visible).toBe(false);
    expect(pin.place()).toBeNull();
    pin.set(null);
    expect(dataset['location']).toBe('');
  });

  it('stands a little above the place, and gives the place on the ground beneath it', () => {
    const dataset: DOMStringMap = {};
    const pin = new PlacePin(dataset);
    pin.set({ latitude: 0, longitude: 0 });
    expect(pin.mesh.visible).toBe(true);
    expect(pin.mesh.position.x).toBeCloseTo(1.004);
    expect(pin.place()?.x).toBeCloseTo(1);
    expect(dataset['location']).toBe('0.00,0.00');
    pin.set({ latitude: 51.4778, longitude: -0.0015 });
    expect(dataset['location']).toBe('51.48,-0.00');
  });
});

describe('createSpinAxis', () => {
  it('is a hidden axis through the poles, each end labelled', () => {
    const axis = createSpinAxis();
    expect(axis.visible).toBe(false);
    const labels = axis.children.filter((child) => child instanceof Sprite);
    expect(labels.map(({ position }) => position.y)).toEqual([1.42, -1.42]);
    expect(axis.children).toHaveLength(3);
  });
});
