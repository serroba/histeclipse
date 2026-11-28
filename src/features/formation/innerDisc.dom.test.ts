// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Group, PerspectiveCamera, type LineLoop, type Mesh, type ShaderMaterial } from 'three';
import type { LineBasicMaterial } from 'three';

import { THEIA_CHOICES } from '../../deepTime/theia';
import { innerDisc } from './innerDisc';
import { CANONICAL } from './impactModel';

const DAY = 86_400;
const YEAR = 365.25 * DAY;

function drawn() {
  const container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { value: 400 });
  Object.defineProperty(container, 'clientHeight', { value: 800 });
  document.body.append(container);
  const camera = new PerspectiveCamera(45, 0.5, 0.1, 100);
  camera.position.set(0, 11, 19);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  let after = (): void => undefined;
  const disc = innerDisc({
    camera,
    container,
    afterRender: (place: () => void) => {
      after = place;
    },
  });
  new Group().add(disc.group);
  const [sheet, limit] = disc.group.children as [
    Mesh<never, ShaderMaterial>,
    LineLoop<never, LineBasicMaterial>,
  ];
  const name = container.querySelector<HTMLElement>('[data-testid="formation-roche"]');
  return {
    disc,
    sheet,
    limit,
    name,
    render: () => {
      after();
    },
  };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('the inner disc as a sheet, inside the Roche limit (#1311)', () => {
  it('shows the sheet, the limit and its name while the disc is there, fading as it clears', () => {
    const { disc, sheet, limit, name } = drawn();
    expect(disc.group.visible).toBe(false);
    expect(name?.hidden).toBe(true);
    disc.update({ seconds: DAY, hit: CANONICAL });
    expect(disc.group.visible).toBe(true);
    expect(name?.hidden).toBe(false);
    expect(name?.textContent).toBe('Roche limit');
    const full = sheet.material.uniforms['opacity']?.value as number;
    expect(full).toBeGreaterThan(0);
    const line = limit.material.opacity;
    disc.update({ seconds: 19 * YEAR, hit: CANONICAL });
    expect(sheet.material.uniforms['opacity']?.value).toBeLessThan(full);
    expect(limit.material.opacity).toBeLessThan(line);
    disc.update({ seconds: 200 * YEAR, hit: CANONICAL });
    expect(disc.group.visible).toBe(false);
    expect(name?.hidden).toBe(true);
  });

  it('draws none for a synestia, or once taken away', () => {
    const { disc, name } = drawn();
    disc.update({ seconds: DAY, hit: THEIA_CHOICES.synestia.hit });
    expect(disc.group.visible).toBe(false);
    disc.update({ seconds: DAY, hit: CANONICAL });
    disc.update(null);
    expect(disc.group.visible).toBe(false);
    expect(name?.hidden).toBe(true);
  });

  it('puts the name at the top of the circle on screen, only while shown', () => {
    const { disc, name, render } = drawn();
    render();
    expect(name?.style.transform).toBe('');
    disc.update({ seconds: DAY, hit: CANONICAL });
    render();
    const match = /translate\(([\d.]+)px, ([\d.]+)px\)/.exec(name?.style.transform ?? '');
    // Centred across, above the middle (the disc's far edge, seen from above the equator).
    expect(Number(match?.[1])).toBeCloseTo(200, 0);
    expect(Number(match?.[2])).toBeLessThan(400);
  });

  it('moves the name to the far side of the circle from the Moon, so they never meet', () => {
    const { disc, name, render } = drawn();
    const y = (): number =>
      Number(/translate\([\d.]+px, ([\d.]+)px\)/.exec(name?.style.transform ?? '')?.[1]);
    disc.update({ seconds: DAY, hit: CANONICAL });
    render();
    const top = y();
    // The Moon beyond the far edge, at the top of the screen: the name goes down the circle.
    disc.update({ seconds: DAY, hit: CANONICAL }, [0, 0, -3.8]);
    render();
    expect(y()).toBeGreaterThan(top + 40);
  });

  it('lets go of what it made', () => {
    const { disc, name } = drawn();
    disc.dispose();
    expect(disc.group.parent).toBeNull();
    expect(name?.isConnected).toBe(false);
  });
});
