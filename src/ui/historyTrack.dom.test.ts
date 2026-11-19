// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { speedsFor } from '../time/playSpeeds';
import { createHistoryTrack } from './historyTrack';

const VIEW = {
  year: 2000,
  first: 1854,
  last: 2026,
  playing: false,
  travelling: false,
  speeds: speedsFor(172),
  speed: 'medium' as const,
  windows: [
    { value: 'all', label: 'The Holocene, 9700 BCE–2026' },
    { value: '1854,2026', label: 'El Niño and La Niña, 1854–2026' },
  ],
  window: '1854,2026',
  changes: '',
  blank: null,
  earth: null,
};

function setUp() {
  const handlers = {
    onYear: vi.fn(),
    onPlay: vi.fn(),
    onSpeed: vi.fn(),
    onEndTravel: vi.fn(),
    onWindow: vi.fn(),
  };
  const track = createHistoryTrack(
    handlers,
    document.createElement('div'),
    document.createElement('div'),
  );
  document.body.replaceChildren(track.root, track.extras);
  return { track, handlers };
}

describe('the Holocene’s track', () => {
  it('Given a view, Then the slider over its window, the year, the speed and the range picked', () => {
    const { track } = setUp();
    track.render(VIEW);
    track.render(VIEW);
    const slider = track.root.querySelector<HTMLInputElement>('.history-slider');
    expect([slider?.min, slider?.max]).toEqual(['1854', '2026']);
    expect(slider?.getAttribute('aria-valuetext')).toBe('2000 CE');
    const range = track.extras.querySelector<HTMLSelectElement>('.history-range');
    expect(range?.options).toHaveLength(2);
    expect(range?.value).toBe('1854,2026');
    const speed = track.extras.querySelector<HTMLSelectElement>('.history-speed');
    expect(speed?.value).toBe('medium');
    expect([...(speed?.options ?? [])].map((option) => option.textContent)).toEqual([
      '2 months/s',
      '1 yr/s',
      '10 yr/s',
    ]);
    expect(track.root.querySelector<HTMLElement>('.history-notes')?.hidden).toBe(true);
    expect(track.extras.querySelector<HTMLElement>('.history-about')?.hidden).toBe(true);
  });

  it('Given what the travel view says, Then its notes, its chip and what it shows', () => {
    const { track } = setUp();
    track.render({
      ...VIEW,
      travelling: true,
      changes: 'By 2000 CE: new A',
      blank: 'Land with no state…',
      earth: 'Sea level…',
    });
    expect(track.root.textContent).toContain('By 2000 CE: new A');
    expect(track.root.querySelector<HTMLElement>('.travel-chip')?.hidden).toBe(false);
    expect(track.extras.querySelector<HTMLElement>('.history-about')?.hidden).toBe(false);
    expect(track.extras.textContent).toContain('Sea level…');
  });

  it('Given the reader’s choices, Then each is heard', () => {
    const { track, handlers } = setUp();
    track.render(VIEW);
    const range = track.extras.querySelector<HTMLSelectElement>('.history-range');
    const speed = track.extras.querySelector<HTMLSelectElement>('.history-speed');
    if (range === null || speed === null) return;
    range.value = 'all';
    range.dispatchEvent(new Event('change'));
    expect(handlers.onWindow).toHaveBeenCalledWith('all');
    speed.value = 'fast';
    speed.dispatchEvent(new Event('change'));
    expect(handlers.onSpeed).toHaveBeenCalledWith('fast');
    speed.value = 'nope';
    speed.dispatchEvent(new Event('change'));
    expect(handlers.onSpeed).toHaveBeenCalledOnce();
    track.root.querySelector<HTMLButtonElement>('.travel-chip')?.click();
    expect(handlers.onEndTravel).toHaveBeenCalledOnce();
    track.root.querySelector<HTMLButtonElement>('.history-play')?.click();
    expect(handlers.onPlay).toHaveBeenCalledWith(true);
    const slider = track.root.querySelector<HTMLInputElement>('.history-slider');
    if (slider === null) return;
    slider.value = '1950';
    slider.dispatchEvent(new Event('input'));
    slider.dispatchEvent(new Event('change'));
    expect(handlers.onYear).toHaveBeenCalledWith(1950);
  });
});
