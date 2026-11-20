// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { createZoomStops, spreadTops, type PlacedStop } from './zoomStops';

const STOPS: PlacedStop[] = [
  { distance: 3, label: 'Earth', title: 'The whole Earth', at: 0.05 },
  { distance: 150, label: 'Moon', title: 'Earth and the Moon’s orbit', at: 0.45 },
  { distance: 60_000, label: 'Planets', title: 'The inner planets, around the Sun', at: 0.86 },
  { distance: 300_000, label: 'Saturn', title: 'Out to Saturn', at: 0.99 },
];

describe('spreading the stops’ labels (#980)', () => {
  it('Given two closer than a label, Then they are spread apart, within the track', () => {
    // A 200-px track: Planets at 172, Saturn at 198, 26 px apart.
    expect(spreadTops([10, 90, 172, 198], 28, 200)).toEqual([10, 90, 172, 200]);
    expect(spreadTops([10, 90, 180, 198], 28, 200)).toEqual([10, 90, 172, 200]);
  });

  it('Given room enough, Then each stays at its place', () => {
    expect(spreadTops([10, 90, 250, 330], 28, 340)).toEqual([10, 90, 250, 330]);
  });

  it('Given a crowd at the top, Then they go down, each as near its place as it can', () => {
    expect(spreadTops([0, 5, 10], 28, 200)).toEqual([0, 28, 56]);
  });
});

describe('the zoom rail’s stops', () => {
  it('Given stops, Then a button each, which zooms to it, and the one reached marked', () => {
    const track = document.createElement('div');
    const onZoom = vi.fn();
    const stops = createZoomStops(track, onZoom);
    stops.place(STOPS);
    const buttons = [...track.querySelectorAll<HTMLButtonElement>('.zoom-stop')];
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Earth',
      'Moon',
      'Planets',
      'Saturn',
    ]);
    // No height yet (happy-dom lays nothing out): each at its share of the track.
    expect(buttons[2]?.style.top).toBe('86%');
    buttons[1]?.click();
    expect(onZoom).toHaveBeenCalledWith(150);
    stops.mark(200);
    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
      'false',
    ]);
    stops.place(STOPS.slice(0, 1));
    expect(track.querySelectorAll('.zoom-stop')).toHaveLength(1);
  });

  it('Given the track’s height, Then the labels are placed in pixels, spread apart', () => {
    const track = document.createElement('div');
    Object.defineProperty(track, 'clientHeight', { value: 200 });
    createZoomStops(track, vi.fn()).place(STOPS);
    const tops = [...track.querySelectorAll<HTMLButtonElement>('.zoom-stop')].map(
      (button) => button.style.top,
    );
    expect(tops).toEqual(['10px', '90px', '172px', '200px']);
  });
});
