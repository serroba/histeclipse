import { describe, expect, it, vi } from 'vitest';
import { defaultViewState, DEFAULT_LOOK } from '../../state/viewState';
import type { Eclipse } from '../../ui/timeline';
import { emptyTap, keyAction, pickedPlace, placePicked, viewChosen, type SkyEntry } from './input';

const base = defaultViewState(new Date(Date.UTC(2024, 3, 8)));
const press = { key: 'a', ctrlKey: false, metaKey: false, typing: false };
const lunar = { kind: 'lunar' } as unknown as Eclipse;
const solar = { elements: {} } as unknown as Eclipse;

describe('the keyboard', () => {
  it('brings the panels back on Escape, even while typing', () => {
    expect(keyAction({ ...press, key: 'Escape', typing: true })).toBe('show-panels');
  });
  it('opens search on "/", unless typing or with a modifier', () => {
    expect(keyAction({ ...press, key: '/' })).toBe('search');
    expect(keyAction({ ...press, key: '/', typing: true })).toBeNull();
    expect(keyAction({ ...press, key: '/', ctrlKey: true })).toBeNull();
    expect(keyAction({ ...press, key: '/', metaKey: true })).toBeNull();
    expect(keyAction(press)).toBeNull();
  });
});

describe('a tap on empty space', () => {
  it('only brings the panels back in the years, and toggles them in deep time', () => {
    expect(emptyTap(base)).toBe('show');
    expect(emptyTap({ ...base, ma: 66 })).toBe('toggle');
  });
});

describe('a place picked', () => {
  const place = { latitude: 51.123456, longitude: -0.987654 };
  it('is kept to four decimals', () => {
    expect(pickedPlace(place)).toEqual({ latitude: 51.1235, longitude: -0.9877 });
  });
  it('is nowhere in deep time: the panels toggle instead', () => {
    expect(placePicked({ ...base, ma: 66 }, place, false, undefined)).toBeNull();
  });
  it('stands there, keeps the time and the why, without an eclipse or "Why here?"', () => {
    const next = placePicked({ ...base, why: 'ways' }, place, false, lunar);
    expect(next?.location).toEqual(pickedPlace(place));
    expect(next?.time).toBe(base.time);
    expect(next?.why).toBe('ways');
  });
  it('opens "Here" while asking', () => {
    expect(placePicked(base, place, true, undefined)?.why).toBe('here');
  });
});

describe('a view chosen', () => {
  const aimAt = vi.fn<SkyEntry['aimAt']>(() => ({ azimuth: 90, altitude: 40, fov: 60 }));
  const entry: SkyEntry = {
    observer: () => ({ latitude: 10, longitude: 20 }),
    aimAt,
    upright: false,
  };
  it('on the globe, is the viewpoint', () => {
    const next = viewChosen({ ...base, mode: 'sky' }, 'moon-from-earth', undefined, entry);
    expect(next.mode).toBe('globe');
    expect(next.view).toBe('moon-from-earth');
  });
  it('the sky stands at the observer and leaves deep time', () => {
    const next = viewChosen({ ...base, ma: 66 }, 'sky', undefined, entry);
    expect(next).toMatchObject({
      mode: 'sky',
      ma: null,
      location: { latitude: 10, longitude: 20 },
    });
    expect(next.look).toEqual(base.look);
  });
  it('held upright, the untouched look is raised', () => {
    const next = viewChosen({ ...base, look: DEFAULT_LOOK }, 'sky', undefined, {
      ...entry,
      upright: true,
    });
    expect(next.look.altitude).not.toBe(DEFAULT_LOOK.altitude);
  });
  it('faces the Sun for a solar eclipse and the Moon for a lunar one, while above the horizon', () => {
    expect(viewChosen(base, 'sky', solar, entry).look.azimuth).toBe(90);
    expect(aimAt).toHaveBeenLastCalledWith(expect.anything(), 'sun');
    viewChosen(base, 'sky', lunar, entry);
    expect(aimAt).toHaveBeenLastCalledWith(expect.anything(), 'moon');
    const below = { ...entry, aimAt: () => ({ azimuth: 90, altitude: -5, fov: 60 }) };
    expect(viewChosen(base, 'sky', solar, below).look).toEqual(base.look);
    const unknown = { ...entry, aimAt: () => null };
    expect(viewChosen(base, 'sky', solar, unknown).look).toEqual(base.look);
  });
});
