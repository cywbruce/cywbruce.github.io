import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('README smoke', () => {
  it('exists and mentions authoring/build commands', () => {
    const readmePath = resolve('README.md');
    expect(existsSync(readmePath)).toBe(true);
    const text = readFileSync(readmePath, 'utf8');
    expect(text).toContain('content/posts');
    expect(text).toContain('npm run build');
  });
});
