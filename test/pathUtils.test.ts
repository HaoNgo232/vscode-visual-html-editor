import { describe, expect, it } from 'bun:test';
import { normalizePath } from '../src/utils/pathUtils';

describe('Path Utilities Test Suite (Bun)', () => {
  it('should normalize backslashes to forward slashes', () => {
    expect(normalizePath('foo\\bar\\baz.css')).toContain('foo/bar/baz.css');
  });

  it('should handle empty input gracefully', () => {
    expect(normalizePath('')).toBe('');
  });

  it('should strip drive letter prefix when stripDrive is true', () => {
    const result = normalizePath('C:\\Users\\project\\index.html', { stripDrive: true });
    expect(result).not.toMatch(/^[a-zA-Z]:/);
    expect(result.toLowerCase()).toContain('/users/project/index.html');
  });
});
