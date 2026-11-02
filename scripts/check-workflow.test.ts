import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('deploy-pages workflow', () => {
  const yaml = readFileSync(
    resolve('.github/workflows/deploy-pages.yml'),
    'utf8',
  );

  it('contains required Pages permissions and deploy steps', () => {
    expect(yaml).toContain('pages: write');
    expect(yaml).toContain('id-token: write');
    expect(yaml).toContain('upload-pages-artifact');
    expect(yaml).toContain('path: dist');
    expect(yaml).toContain('deploy-pages');
    expect(yaml).toMatch(/branches:\s*\n\s*-\s*main/);
  });
});
