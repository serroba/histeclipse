import { describe, expect, it } from 'vitest';

import data from '../../public/data/spacecraft.json';
import { destinations, loadSpacecraft } from './spacecraft';

const file = JSON.stringify(data);
const serve = (body: string) => () => Promise.resolve(new Response(body));
const record = await loadSpacecraft('spacecraft.json', serve(file));
const named = (name: string) => record.craft.find((craft) => craft.name === name);

describe('every craft sent beyond Earth orbit', () => {
  it('Given the file the pipeline wrote, Then it holds hundreds of craft, from Luna 1 to this year', () => {
    expect(record.craft.length).toBeGreaterThan(350);
    const launches = record.craft.map(({ launch }) => launch).sort();
    expect(launches[0]?.startsWith('1959-01')).toBe(true);
    expect(launches.at(-1)?.startsWith('2026')).toBe(true);
  });

  it('Given Voyager 2, Then it went to the four giant planets, in order, and flies on', () => {
    const voyager = named('Voyager 2');
    expect(voyager === undefined ? [] : destinations(voyager)).toEqual([
      'Jupiter',
      'Saturn',
      'Uranus',
      'Neptune',
    ]);
    expect(voyager?.phases.at(-1)?.[2]).toBeNull();
  });

  it('Given Apollo 11, Then its crewed craft and its lander are named for the mission, and the lander landed', () => {
    const columbia = named('Columbia');
    expect(columbia?.crewed).toBe(true);
    expect(columbia?.mission).toBe('Apollo 11');
    const landed = record.craft.filter(
      (craft) => craft.mission === 'Apollo 11' && craft.landing?.world === 'Luna',
    );
    expect(landed.length).toBeGreaterThan(0);
  });

  it('Given a probe carried and set loose, Then it knows its carrier', () => {
    const huygens = named('Huygens');
    expect(huygens?.mission).toBe('Cassini');
    expect(huygens?.about).toBe('Titan Probe');
  });

  it('Given those that set out but never left, Then the early failures and Mars 96 are among them', () => {
    const names = record.neverLeft.map(({ name }) => name);
    expect(names).toContain('Mars 96');
    expect(names).toContain('Pioneer 0');
    expect(record.neverLeft.length).toBeGreaterThan(40);
  });

  it('Given a phase with a date that is not GCAT’s, Then the file is refused', async () => {
    const bad = JSON.parse(file) as { craft: { phases: unknown[][] }[] };
    const phase = bad.craft[0]?.phases[0];
    if (phase !== undefined) phase[1] = '22 August 1977';
    await expect(loadSpacecraft('spacecraft.json', serve(JSON.stringify(bad)))).rejects.toThrow();
  });
});
