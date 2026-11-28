import { describe, expect, it } from 'vitest';

import type { LifeNode } from '../../data/lifeStories';
import { capitalised, listed, plainName } from './words';

const node = (name: string, common: string): LifeNode => ({
  index: 0,
  pbdb: 1,
  name,
  common,
  rank: 'family',
  parent: -1,
  children: [],
  living: true,
  sites: [],
});

describe('the stories’ words', () => {
  it('calls a lineage by its common name where it has one, else by its own', () => {
    expect(plainName(node('Felidae', 'cat'))).toBe('cat');
    expect(plainName(node('Feloidea', ''))).toBe('Feloidea');
  });

  it('lists names with commas and an and', () => {
    expect(listed([])).toBe('');
    expect(listed(['Asia'])).toBe('Asia');
    expect(listed(['Asia', 'Africa'])).toBe('Asia and Africa');
    expect(listed(['Asia', 'Africa', 'Europe'])).toBe('Asia, Africa and Europe');
  });

  it('gives a name its capital', () => {
    expect(capitalised('lion')).toBe('Lion');
    expect(capitalised('')).toBe('');
  });
});

describe('a count with its noun', () => {
  it('is singular for one and plural otherwise', async () => {
    const { counted } = await import('./words');
    expect(counted(1, 'kind')).toBe('1 kind');
    expect(counted(0, 'kind')).toBe('0 kinds');
    expect(counted(12, 'site')).toBe('12 sites');
  });
});
