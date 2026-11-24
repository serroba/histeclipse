// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { HistoryLayers, type PaintedLayer, SEA_PAINT_ORDERS } from './historyLayers';
import { HISTORY_PAINT_ORDER } from './layerHost';

type Named = HTMLCanvasElement & { readonly name: string };

/** A canvas whose 2D context records what is drawn on it, by the canvas's name. */
function canvas(name: string, calls: string[], drawable = true): Named {
  const context = {
    drawImage: (from: Named) => calls.push(`${name}: copy ${from.name}`),
  };
  return {
    name,
    width: 8,
    height: 4,
    getContext: () => (drawable ? context : null),
  } as unknown as Named;
}

function setup() {
  const calls: string[] = [];
  let made = 0;
  const layers = new HistoryLayers({
    make: () => canvas(`kept${String((made += 1))}`, calls),
    clear: (target) => calls.push(`${(target as Named).name}: clear`),
  });
  const map = canvas('map', calls);
  const layer = (order: number, name: string): PaintedLayer => ({
    order,
    key: name,
    paint: (target) => calls.push(`${(target as Named).name}: ${name}`),
  });
  return { calls, layers, map, layer };
}

const { ways, oceanTemp, enso, amoc, states } = HISTORY_PAINT_ORDER;

describe('history’s map, the sea’s maps kept from repainting the others (#1045)', () => {
  it('names the sea’s maps', () => {
    expect([...SEA_PAINT_ORDERS].sort()).toEqual([40, 43, 45]);
  });

  it('paints in order, keeping nothing, while only the sea’s or only the others are on', () => {
    const { calls, layers, map, layer } = setup();
    layers.paint(map, [layer(ways, 'ways'), layer(states, 'states')]);
    layers.paint(map, [layer(oceanTemp, 'temp'), layer(enso, 'enso')]);
    expect(calls).toEqual([
      'map: clear',
      'map: ways',
      'map: states',
      'map: clear',
      'map: temp',
      'map: enso',
    ]);
    expect(layers.kept).toEqual({ under: false, over: false });
  });

  it('with both, keeps what is under and over the sea’s maps, everything in its order', () => {
    const { calls, layers, map, layer } = setup();
    const under = layer(ways, 'ways');
    const over = [layer(amoc, 'amoc'), layer(states, 'states')];
    const month = (name: string): PaintedLayer[] => [
      under,
      layer(oceanTemp, 'temp'),
      layer(enso, name),
      ...over,
    ];
    layers.paint(map, month('enso 1998-01'), true);
    expect(calls).toEqual([
      'map: clear',
      'kept1: clear',
      'kept1: ways',
      'map: copy kept1',
      'map: temp',
      'map: enso 1998-01',
      'kept2: clear',
      'kept2: amoc',
      'kept2: states',
      'map: copy kept2',
    ]);
    calls.length = 0;
    // Another month: nothing kept is painted again.
    layers.paint(map, month('enso 1998-02'), true);
    expect(calls).toEqual([
      'map: clear',
      'map: copy kept1',
      'map: temp',
      'map: enso 1998-02',
      'map: copy kept2',
    ]);
  });

  it('paints a kept map again when one of its layers changes, or what they paint by', () => {
    const { calls, layers, map, layer } = setup();
    const sea = layer(enso, 'enso');
    layers.paint(map, [sea, layer(states, 'states 1900')], true);
    calls.length = 0;
    layers.paint(map, [sea, layer(states, 'states 1901')], true);
    expect(calls).toContain('kept1: states 1901');
    calls.length = 0;
    layers.paint(map, [sea, layer(states, 'states 1901')], false);
    expect(calls).toContain('kept1: states 1901');
  });

  it('lets a kept map go once it is not needed, and makes a new one when it is', () => {
    const { calls, layers, map, layer } = setup();
    layers.paint(map, [layer(ways, 'ways'), layer(enso, 'enso'), layer(states, 'states')]);
    expect(layers.kept).toEqual({ under: true, over: true });
    layers.paint(map, [layer(enso, 'enso'), layer(states, 'states')]);
    expect(layers.kept).toEqual({ under: false, over: true });
    layers.paint(map, [layer(states, 'states')]);
    expect(layers.kept).toEqual({ under: false, over: false });
    layers.paint(map, [layer(enso, 'enso'), layer(states, 'states')]);
    expect(calls).toContain('kept3: states');
  });

  it('paints in order on a map with no 2D context, keeping nothing', () => {
    const { calls, layers, layer } = setup();
    const broken = canvas('broken', calls, false);
    layers.paint(broken, [layer(enso, 'enso'), layer(states, 'states')]);
    expect(calls).toEqual(['broken: clear', 'broken: enso', 'broken: states']);
  });
});
