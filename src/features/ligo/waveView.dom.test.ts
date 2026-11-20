// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { WAVE_EVENTS } from './events';
import { chirp, GW150914_STAND_IN } from './strain';
import { framing, mountWaveView, type WaveRenderer } from './waveView';

interface StandIn {
  readonly renderer: WaveRenderer;
  readonly disposed: ReturnType<typeof vi.fn>;
  readonly lost: ReturnType<typeof vi.fn>;
  loop: ((now: number) => void) | null;
  renders: number;
}

function standIn(): StandIn {
  const disposed = vi.fn();
  const lost = vi.fn();
  const fake: StandIn = {
    disposed,
    lost,
    loop: null,
    renders: 0,
    renderer: {
      domElement: document.createElement('canvas'),
      setPixelRatio: () => undefined,
      setSize: () => undefined,
      setClearColor: () => undefined,
      setAnimationLoop: (loop) => {
        fake.loop = loop;
      },
      render: () => {
        fake.renders += 1;
      },
      dispose: disposed,
      forceContextLoss: lost,
    },
  };
  return fake;
}

const wave = chirp(GW150914_STAND_IN);

function mount(stillness: boolean): {
  host: HTMLElement;
  fake: StandIn;
  moments: string[];
  ends: boolean[];
  view: ReturnType<typeof mountWaveView>;
} {
  const host = document.createElement('div');
  const fake = standIn();
  const moments: string[] = [];
  const ends: boolean[] = [];
  const view = mountWaveView(host, {
    wave,
    bodies: WAVE_EVENTS.gw150914.bodies,
    stillness,
    chapter: 'space',
    atLivingston: 0.41,
    onChapterEnd: () => {
      ends.push(true);
    },
    onMoment: (text) => moments.push(text),
    renderer: () => fake.renderer,
  });
  return { host, fake, moments, ends, view };
}

describe('the wave passing, drawn (#829)', () => {
  it('Given the view, When frames are drawn, Then its canvas is in the host, marked drawn, and the moment told once', () => {
    const { host, fake, moments } = mount(false);
    expect(host.querySelector('[data-testid="wave-canvas"]')).toBe(fake.renderer.domElement);
    fake.loop?.(0);
    fake.loop?.(16);
    expect(fake.renders).toBe(2);
    expect(host.dataset['drawn']).toBe('true');
    expect(host.dataset['playing']).toBe('true');
    expect(moments).toEqual(['Space at rest: the wave has not arrived.']);
  });

  it('Given it plays, When time goes on, Then the wave arrives; held, it does not move', () => {
    const { fake, moments, view } = mount(false);
    fake.loop?.(0);
    for (let now = 0; now <= 3000; now += 100) fake.loop?.(now);
    expect(moments.at(-1)).toMatch(/before the merger/);
    view.setPlaying(false);
    const held = moments.length;
    for (let now = 3000; now <= 6000; now += 100) fake.loop?.(now);
    expect(moments).toHaveLength(held);
    view.restart();
    view.setPlaying(true);
    fake.loop?.(6100);
    expect(moments.at(-1)).toContain('not arrived');
  });

  it('Given less motion asked for, When drawn, Then it holds at the merger', () => {
    const { host, fake, moments } = mount(true);
    fake.loop?.(0);
    fake.loop?.(5000);
    expect(host.dataset['playing']).toBe('false');
    expect(moments).toEqual(['The merger · 150 Hz']);
  });

  it('Given a chapter played through, Then it says so once, and again after a restart', () => {
    const { fake, ends, view } = mount(false);
    fake.loop?.(0);
    for (let now = 100; now <= 30_000; now += 100) fake.loop?.(now);
    expect(ends).toHaveLength(1);
    view.restart();
    for (let now = 30_100; now <= 60_000; now += 100) fake.loop?.(now);
    expect(ends).toHaveLength(2);
    view.setChapter('journey');
    fake.loop?.(60_100);
    expect(ends).toHaveLength(2);
  });

  it('Given the view, When the detector is chosen, Then it says so and still draws', () => {
    const { host, fake, view } = mount(false);
    expect(host.dataset['chapter']).toBe('space');
    view.setChapter('detector');
    expect(host.dataset['chapter']).toBe('detector');
    fake.loop?.(0);
    expect(fake.renders).toBe(1);
  });

  it('Given the view, When disposed, Then the renderer and its context are let go', () => {
    const { host, fake, view } = mount(false);
    fake.loop?.(0);
    view.dispose();
    expect(fake.loop).toBeNull();
    expect(fake.disposed).toHaveBeenCalled();
    expect(fake.lost).toHaveBeenCalled();
    expect(host.querySelector('canvas')).toBeNull();
    expect(host.dataset['drawn']).toBeUndefined();
  });
});

describe('framing the ring above the stage', () => {
  it('lifts the view by half what the stage covers, and backs off to fit what is left', () => {
    const open = framing(1000, 800, 0);
    const covered = framing(1000, 800, 400);
    expect(open.lift).toBe(0);
    expect(covered.lift).toBe(200);
    expect(covered.distance).toBeCloseTo(open.distance * 2, 9);
  });

  it('backs off on an upright screen to keep the width, and never lets the stage take it all', () => {
    expect(framing(400, 800, 0).distance).toBeCloseTo(framing(800, 800, 0).distance * 2, 9);
    expect(framing(800, 800, 5000).lift).toBe(240);
  });
});
