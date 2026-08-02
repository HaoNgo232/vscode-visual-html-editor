import { describe, expect, it } from 'bun:test';
import * as path from 'node:path';
import { isPathContained } from '../src/utils/securityUtils';

describe('Security Utils - Path Containment Guard Test Suite', () => {
  it('should return true for files directly inside root folder', () => {
    const root = path.resolve('/workspace/project');
    const target = path.resolve('/workspace/project/index.html');
    expect(isPathContained(root, target)).toBe(true);
  });

  it('should return true for nested subdirectories inside root folder', () => {
    const root = path.resolve('/workspace/project');
    const target = path.resolve('/workspace/project/src/assets/logo.png');
    expect(isPathContained(root, target)).toBe(true);
  });

  it('should return true when target is identical to root folder', () => {
    const root = path.resolve('/workspace/project');
    expect(isPathContained(root, root)).toBe(true);
  });

  it('should return false for prefix bypass attempt on sibling directory', () => {
    // Crucial bug fix test: /workspace/project-secret starts with /workspace/project string-wise
    // but is NOT contained within /workspace/project folder!
    const root = path.resolve('/workspace/project');
    const attackTarget = path.resolve('/workspace/project-secret/credentials.json');
    expect(isPathContained(root, attackTarget)).toBe(false);
  });

  it('should return false for parent directory traversal (..)', () => {
    const root = path.resolve('/workspace/project');
    const attackTarget = path.resolve('/workspace/project/../etc/passwd');
    expect(isPathContained(root, attackTarget)).toBe(false);
  });

  it('should return false for completely external absolute paths', () => {
    const root = path.resolve('/workspace/project');
    const external = path.resolve('/var/log/system.log');
    expect(isPathContained(root, external)).toBe(false);
  });

  it('should handle root paths with trailing slashes correctly', () => {
    const rootWithSlash = path.resolve('/workspace/project') + path.sep;
    const target = path.resolve('/workspace/project/app.js');
    const attackTarget = path.resolve('/workspace/project-malicious/app.js');

    expect(isPathContained(rootWithSlash, target)).toBe(true);
    expect(isPathContained(rootWithSlash, attackTarget)).toBe(false);
  });

  it('should return false for empty or null inputs', () => {
    expect(isPathContained('', '/some/path')).toBe(false);
    expect(isPathContained('/some/path', '')).toBe(false);
    expect(isPathContained('', '')).toBe(false);
  });
});
