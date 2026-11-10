/**
 * The embedding model the site runs, as `models.lock.json` pins it (#393): where its files are
 * served, and the instruction bge puts before a query. A test keeps the two the same.
 */

export const EMBEDDING_MODEL = {
  name: 'bge-small-en-v1.5',
  query: 'Represent this sentence for searching relevant passages: ',
} as const;
