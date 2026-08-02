import * as path from 'path';

/**
 * Safely verifies if a target path is contained within a root/parent directory.
 * Prevents Path Containment / Directory Traversal bypasses (e.g. prefix matching flaws where
 * `/app-secret` matches `/app` via `startsWith`).
 *
 * @param parentPath The parent directory allowed root path.
 * @param childPath The target file or directory path to validate.
 * @returns `true` if childPath is located within parentPath or identical to it; otherwise `false`.
 */
export function isPathContained(parentPath: string, childPath: string): boolean {
  if (!parentPath || !childPath) {
    return false;
  }
  const normParent = path.resolve(parentPath);
  const normChild = path.resolve(childPath);

  const relative = path.relative(normParent, normChild);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
