import { describe, expect, it } from 'vitest';

import lock from '../../models.lock.json';
import { EMBEDDING_MODEL } from './model';

describe('the embedding model', () => {
  it('Given the lock the pipeline and the build share, Then the site runs the model it pins', () => {
    expect(EMBEDDING_MODEL.name).toBe(lock.embedding.name);
    expect(EMBEDDING_MODEL.query).toBe(lock.embedding.query);
    expect(lock.embedding.site).toContain('vocab.txt');
  });
});
