// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import lunarBce600 from '../../../public/data/lunar/-600.json';
import solarBce800 from '../../../public/data/solar/-800.json';
import { greatestEclipseUT } from '../../data/catalog';
import type { LunarEclipse } from '../../data/lunarCatalog';
import type { SolarEclipse } from '../../data/solarCatalog';
import { createFollowToggle, eventPoint } from './followToggle';

const solar = (solarBce800 as unknown as SolarEclipse[]).find(
  (eclipse) => eclipse.kind === 'total',
);
const lunar = (lunarBce600 as unknown as LunarEclipse[])[0];
if (solar === undefined || lunar === undefined) throw new Error('no eclipses');

describe('where an eclipse is, to follow it (#208)', () => {
  it('is a solar eclipse’s shadow near greatest eclipse, and nowhere past its elements', () => {
    const at = eventPoint(solar, greatestEclipseUT(solar), 0);
    // Earth taken as a sphere for the centre line: within a degree of the catalogue's.
    expect(Math.abs((at?.latitude ?? 0) - solar.greatest[0])).toBeLessThan(1);
    expect(eventPoint(solar, greatestEclipseUT(solar) + 1, 1440)).toBeNull();
  });

  it('is the place under a lunar eclipse’s Moon, drifting west by the hour', () => {
    const [latitude, longitude] = lunar.sublunar;
    const now = eventPoint(lunar, greatestEclipseUT(lunar), 0);
    expect(now?.latitude).toBe(latitude);
    expect(now?.longitude).toBeCloseTo(longitude, 6);
    const later = eventPoint(lunar, greatestEclipseUT(lunar) + 1 / 24, 60);
    expect(later?.latitude).toBe(latitude);
    expect(later?.longitude).not.toBe(longitude);
  });
});

describe('Follow the event (#208)', () => {
  it('is named for the eclipse, and turns the globe to it only while pressed', () => {
    const onChange = vi.fn();
    const flyTo = vi.fn();
    const globe = new EventTarget();
    const toggle = createFollowToggle({ flyTo, canvas: globe }, onChange);
    toggle.show(solar, greatestEclipseUT(solar), 0);
    expect(toggle.root.textContent).toBe('Follow the shadow');
    expect(toggle.root.getAttribute('aria-pressed')).toBe('false');
    expect(flyTo).not.toHaveBeenCalled();
    toggle.root.click();
    expect(toggle.on()).toBe(true);
    expect(toggle.root.getAttribute('aria-pressed')).toBe('true');
    expect(onChange).toHaveBeenCalledOnce();
    toggle.show(lunar, greatestEclipseUT(lunar), 0);
    expect(toggle.root.textContent).toBe('Follow the Moon');
    expect(flyTo).toHaveBeenCalledOnce();
  });

  it('lets go when the reader drags the globe', () => {
    const flyTo = vi.fn();
    const globe = new EventTarget();
    const toggle = createFollowToggle({ flyTo, canvas: globe }, vi.fn());
    toggle.root.click();
    globe.dispatchEvent(new Event('pointerdown'));
    expect(toggle.on()).toBe(false);
    toggle.show(solar, greatestEclipseUT(solar), 0);
    expect(flyTo).not.toHaveBeenCalled();
  });
});
