import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { loadTelescopes, type Telescope, type Telescopes } from '../../data/telescopes';
import { dateText, groundMarks, telescopeCard, telescopesText } from './telescopeMarks';

const raw: unknown = JSON.parse(readFileSync('public/data/telescopes.json', 'utf8'));
const record: Telescopes = await loadTelescopes('t.json', () =>
  Promise.resolve(new Response(JSON.stringify(raw))),
);
const named = (id: string): Telescope => {
  const found = record.telescopes.find((telescope) => telescope.id === id);
  if (found === undefined) throw new Error(`no ${id}`);
  return found;
};
const ids = (year: number): string[] => groundMarks(record, year).map((mark) => mark.key);

describe('the ground telescopes in a year (#848)', () => {
  it('shows each from its first light, and not before', () => {
    expect(ids(1788)).toEqual([]);
    expect(ids(1789)).toEqual(['herschel-forty-foot']);
    expect(ids(1850)).toContain('leviathan');
    expect(ids(1850)).not.toContain('herschel-forty-foot');
  });

  it('takes away those that closed: Arecibo after 2020', () => {
    expect(ids(2020)).toContain('arecibo');
    expect(ids(2021)).not.toContain('arecibo');
  });

  it('gathers those sharing a mountain on one marker, named together', () => {
    const mauna = groundMarks(record, 2026).find((mark) => mark.key.includes('keck'));
    expect(mauna?.key).toBe('keck+subaru');
    expect(mauna?.name).toBe('Keck Observatory · Subaru Telescope');
  });

  it('marks those being built as such, the ELT among them', () => {
    const elt = groundMarks(record, 2026).find((mark) => mark.key === 'elt');
    expect(elt?.building).toBe(true);
    expect(groundMarks(record, 2026).find((mark) => mark.key === 'vlt')?.building).toBe(false);
  });
});

describe('a telescope’s card', () => {
  it('says what it sees, its size, its years, where it is, and why it is here', () => {
    const card = telescopeCard(named('arecibo'));
    expect(card.title).toBe('Arecibo Telescope');
    expect(card.facts).toContainEqual(['Sees', 'radio']);
    expect(card.facts).toContainEqual(['First light', '1 November 1963']);
    expect(card.facts).toContainEqual(['Until', '1 December 2020']);
    expect(card.facts.some(([label]) => label === 'Known for')).toBe(true);
    expect(card.note).toContain('largest single-dish');
    expect(card.links.length).toBeGreaterThan(0);
  });

  it('gives a space telescope its orbit, and one being built its expected first light', () => {
    expect(telescopeCard(named('webb')).facts).toContainEqual([
      'Orbit',
      'about L2, 1.5 million km from Earth',
    ]);
    expect(telescopeCard(named('webb')).facts).toContainEqual(['Worked until', 'Still working']);
    expect(telescopeCard(named('hubble')).facts).toContainEqual(['Orbit', 'low Earth']);
    expect(telescopeCard(named('elt')).facts).toContainEqual([
      'Until',
      'Being built; first light expected 2029',
    ]);
    expect(telescopeCard(named('ska-low')).facts).toContainEqual(['Until', 'Being built']);
  });
});

describe('the words for a date and a year', () => {
  it('give a date as precisely as its source', () => {
    expect(dateText('1897')).toBe('1897');
    expect(dateText('1845-02')).toBe('February 1845');
    expect(dateText('1897-05-21')).toBe('21 May 1897');
  });

  it('say how many were working, and being built', () => {
    expect(telescopesText(groundMarks(record, 1700), 1700)).toContain('Herschel’s 40-foot');
    expect(telescopesText(groundMarks(record, 1900), 1900)).toMatch(/^2 of the great telescopes/);
    expect(telescopesText(groundMarks(record, 2026), 2026)).toMatch(/and 3 being built/);
  });

  it('Given a radio telescope with a model, Then its card carries it; one without has none (#859)', () => {
    expect(telescopeCard(named('lovell')).model?.label).toContain('Lovell Telescope in 3D');
    expect('model' in telescopeCard(named('chandra'))).toBe(false);
  });
});
