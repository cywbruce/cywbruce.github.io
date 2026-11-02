import { describe, expect, it } from 'vitest';

export const SCAFFOLD_OK = true;

describe('scaffold smoke', () => {
  it('exports a truthy constant', () => {
    expect(SCAFFOLD_OK).toBe(true);
  });
});
