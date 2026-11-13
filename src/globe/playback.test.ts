import { Group, MeshBasicMaterial } from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ImpactSpec } from './impactAnimation';
import { Playback } from './playback';
import type { ShowerSpec, ShowerState } from './showerAnimation';

/** Each impact plays until the moment the test gives it. */
const impacts: { group: Group; ends: number; disposed: boolean }[] = [];
const showers: {
  group: Group;
  spec: ShowerSpec;
  drawing: boolean;
  commands: string[];
  size: number[];
  disposed: boolean;
}[] = [];

vi.mock('./impactAnimation', () => ({
  createImpactAnimation: (spec: { readonly ends: number }) => {
    const impact = { group: new Group(), ends: spec.ends, disposed: false };
    impacts.push(impact);
    return {
      group: impact.group,
      update: (now: number) => now < impact.ends,
      dispose: () => {
        impact.disposed = true;
      },
    };
  },
}));

vi.mock('./showerAnimation', () => ({
  createShowerAnimation: (spec: ShowerSpec) => {
    const shower = {
      group: new Group(),
      spec,
      drawing: true,
      commands: [] as string[],
      size: [] as number[],
      disposed: false,
    };
    showers.push(shower);
    return {
      group: shower.group,
      setResolution: (x: number, y: number) => {
        shower.size = [x, y];
      },
      update: () => shower.drawing,
      command: (command: string) => shower.commands.push(command),
      dispose: () => {
        shower.disposed = true;
      },
    };
  },
}));

function playback() {
  const earth = new Group();
  const pin = new MeshBasicMaterial();
  const dataset: Record<string, string> = {};
  let drawn = 0;
  const play = new Playback({
    earth,
    pin,
    dataset: dataset,
    resolution: () => ({ x: 900, y: 700 }),
    invalidate: () => (drawn += 1),
  });
  return { play, earth, pin, dataset, drawn: () => drawn };
}

const impact = (ends: number) => ({ ends }) as unknown as ImpactSpec;

const shower = (onState: (state: ShowerState) => void = () => undefined): ShowerSpec => ({
  place: { latitude: 60, longitude: 10 },
  dipole: 8,
  water: true,
  fromSun: false,
  onState,
});

beforeEach(() => {
  impacts.length = 0;
  showers.length = 0;
});

describe('impacts playing on Earth', () => {
  it('plays each on Earth, draws while any plays, and counts those played out', () => {
    const { play, earth, dataset } = playback();
    expect(play.step(0)).toBe(false);
    play.playImpact(impact(10));
    play.playImpact(impact(20));
    expect(earth.children).toHaveLength(2);
    expect(dataset['impactPlaying']).toBe('true');
    expect(play.step(15)).toBe(true);
    expect(dataset['impactsPlayed']).toBe('1');
    expect(dataset['impactPlaying']).toBe('true');
    expect(play.step(25)).toBe(true);
    expect(dataset['impactsPlayed']).toBe('2');
    expect(dataset['impactPlaying']).toBe('false');
    expect(play.step(30)).toBe(false);
  });

  it('lets the oldest make way beyond eight at once', () => {
    const { play } = playback();
    for (let index = 0; index < 9; index += 1) play.playImpact(impact(100));
    expect(impacts[0]?.disposed).toBe(true);
    expect(impacts.filter(({ disposed }) => !disposed)).toHaveLength(8);
  });
});

describe('a cosmic-ray shower', () => {
  it('plays on Earth with the pin at rest, and says what it shows', () => {
    const { play, earth, pin, dataset } = playback();
    play.playShower(shower());
    expect(earth.children).toHaveLength(1);
    expect(pin.visible).toBe(false);
    expect(dataset['pinShown']).toBe('false');
    expect(dataset['showerGround']).toBe('water');
    expect(dataset['showerLabels']).toContain('|');
    expect(play.step(0)).toBe(true);
    expect(showers[0]?.size).toEqual([900, 700]);
    if (showers[0] !== undefined) showers[0].drawing = false;
    expect(play.step(1)).toBe(false);
  });

  it('reports every step once, in order, and counts each played to its end once', () => {
    const states: ShowerState[] = [];
    const { play, dataset } = playback();
    play.playShower(shower((state) => states.push(state)));
    const onState = showers[0]?.spec.onState ?? (() => undefined);
    onState({ step: 'rays', playing: true, ended: false });
    onState({ step: 'rays', playing: false, ended: false });
    onState({ step: 'plant', playing: false, ended: true });
    onState({ step: 'plant', playing: false, ended: true });
    expect(dataset['showerSteps']).toBe('rays plant');
    expect(dataset['showerPlaying']).toBe('false');
    expect(dataset['showersPlayed']).toBe('1');
    expect(states).toHaveLength(4);
  });

  it('is played, paused and stopped, and takes the last one away when another starts', () => {
    const { play, pin, dataset, drawn } = playback();
    play.controlShower('play');
    expect(drawn()).toBe(0);
    play.playShower(shower());
    play.controlShower('pause');
    expect(dataset['showerPlaying']).toBe('false');
    play.controlShower('replay');
    expect(dataset['showerPlaying']).toBe('true');
    play.controlShower('next');
    expect(showers[0]?.commands).toEqual(['pause', 'replay', 'next']);
    play.playShower(shower());
    expect(showers[0]?.disposed).toBe(true);
    play.controlShower('stop');
    expect(showers[1]?.disposed).toBe(true);
    expect(pin.visible).toBe(true);
    expect(dataset['showerStep']).toBe('done');
    play.dispose();
  });

  it('disposes what still plays', () => {
    const { play } = playback();
    play.playImpact(impact(10));
    play.playShower(shower());
    play.dispose();
    expect(impacts[0]?.disposed).toBe(true);
    expect(showers[0]?.disposed).toBe(true);
  });
});
