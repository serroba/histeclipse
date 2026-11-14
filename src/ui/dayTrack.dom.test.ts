// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { createDayTrack, type DayMoment, type DayView } from './dayTrack';

const moments: readonly DayMoment[] = [
  { name: 'Luna 1', meaning: 'Flyby', jd: 100, date: '2 Jan 1959' },
  { name: 'Pioneer 4', meaning: 'Flyby', jd: 160, date: '3 Mar 1959' },
  { name: 'Luna 2', meaning: 'Impact', jd: 350, date: '12 Sep 1959' },
];

const view = (more: Partial<DayView> = {}): DayView => ({
  title: 'Launches',
  slider: 'Day since the first launch',
  jd: 100,
  first: 100,
  last: 500,
  moments,
  since: 'Luna 1',
  playing: false,
  speed: 2400,
  ...more,
});

function track() {
  const handlers = { onDay: vi.fn(), onPlay: vi.fn(), onSpeed: vi.fn(), onLeave: vi.fn() };
  const ui = createDayTrack(
    { className: 'launch-track', speeds: [240, 2400], play: 'Play', stop: 'Stop', leave: 'Back' },
    handlers,
  );
  document.body.append(ui.root, ui.extras);
  const chips = () => [...ui.root.querySelectorAll<HTMLButtonElement>('.cycle-moment')];
  const current = () =>
    chips()
      .filter((chip) => chip.getAttribute('aria-current') === 'true')
      .map((chip) => chip.querySelector('.cycle-moment-name')?.textContent);
  return { ui, handlers, chips, current };
}

describe('days to play in the bar', () => {
  it('Given nothing to play, Then the track and its speed are hidden', () => {
    const { ui } = track();
    ui.render(null);
    expect(ui.root.hidden).toBe(true);
    expect(ui.extras.hidden).toBe(true);
  });

  it('Given its moments, Then each has a chip and a tick, placed along the days', () => {
    const { ui, chips } = track();
    ui.render(view());
    expect(ui.root.hidden).toBe(false);
    expect(ui.root.classList.contains('launch-track')).toBe(true);
    expect(chips().map((chip) => chip.title)).toEqual(['Flyby', 'Flyby', 'Impact']);
    const ticks = [...ui.root.querySelectorAll<HTMLElement>('.cycle-tick')];
    expect(ticks.map((tick) => tick.style.left)).toEqual(['0%', '15%', '62.5%']);
  });

  it('Given the days going by, Then the moment last passed is the current one', () => {
    const { ui, current } = track();
    ui.render(view({ jd: 100 }));
    expect(current()).toEqual(['Luna 1']);
    ui.render(view({ jd: 200 }));
    expect(current()).toEqual(['Pioneer 4']);
    ui.render(view({ jd: 499 }));
    expect(current()).toEqual(['Luna 2']);
  });

  it('Given it playing, Then its button stops it; not playing, plays it', () => {
    const { ui, handlers } = track();
    const button = ui.root.querySelector<HTMLButtonElement>('.history-play');
    ui.render(view({ playing: true }));
    expect(button?.getAttribute('aria-label')).toBe('Stop');
    button?.click();
    expect(handlers.onPlay).toHaveBeenLastCalledWith(false);
    ui.render(view({ playing: false }));
    expect(button?.getAttribute('aria-label')).toBe('Play');
    button?.click();
    expect(handlers.onPlay).toHaveBeenLastCalledWith(true);
  });

  it('Given a chip tapped, the slider moved or a speed picked, Then each is said', () => {
    const { ui, handlers, chips } = track();
    ui.render(view());
    chips()[2]?.click();
    expect(handlers.onDay).toHaveBeenLastCalledWith(350);
    const slider = ui.root.querySelector<HTMLInputElement>('.history-slider');
    if (slider !== null) {
      slider.value = '250';
      slider.dispatchEvent(new Event('input'));
    }
    expect(handlers.onDay).toHaveBeenLastCalledWith(250);
    const speed = ui.extras.querySelector('select');
    if (speed !== null) {
      speed.value = '240';
      speed.dispatchEvent(new Event('change'));
    }
    expect(handlers.onSpeed).toHaveBeenLastCalledWith(240);
    expect([...(speed?.options ?? [])].map((option) => option.text)).toEqual([
      '10 days/s',
      '100 days/s',
    ]);
  });

  it('Given the slider, Then it reads how many days since the first moment', () => {
    const { ui } = track();
    ui.render(view({ jd: 160 }));
    const slider = ui.root.querySelector('.history-slider');
    expect(slider?.getAttribute('aria-valuetext')).toBe('60 days after Luna 1');
  });

  it('Given paces of its own, Then the speed picker offers those, until they change', () => {
    const { ui, handlers } = track();
    const speeds = [1, 3, 6];
    ui.render(view({ speeds, speed: 3 }));
    const speed = ui.extras.querySelector('select');
    expect([...(speed?.options ?? [])].map((option) => option.text)).toEqual([
      '1 hour/s',
      '3 hours/s',
      '6 hours/s',
    ]);
    expect(speed?.value).toBe('3');
    if (speed !== null) {
      speed.value = '6';
      speed.dispatchEvent(new Event('change'));
    }
    expect(handlers.onSpeed).toHaveBeenLastCalledWith(6);
  });

  it('Given something to leave, Then its button shows, and says so when pressed', () => {
    const { ui, handlers } = track();
    const leave = ui.root.querySelector<HTMLButtonElement>('.day-leave');
    ui.render(view());
    expect(leave?.hidden).toBe(true);
    ui.render(view({ leave: true }));
    expect(leave?.hidden).toBe(false);
    expect(leave?.textContent).toBe('Back');
    leave?.click();
    expect(handlers.onLeave).toHaveBeenCalledTimes(1);
  });
});
