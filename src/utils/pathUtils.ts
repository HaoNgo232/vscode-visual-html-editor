import * as path from 'node:path';

const isWindowsPlatform = typeof process !== 'undefined' && process.platform === 'win32';

/**
 * Cross-platform path normalizer utility.
 * - Converts all backslashes (\) to forward slashes (/)
 * - Optionally strips Windows drive letter prefixes (e.g. C:) for deterministic relative/traversal comparison
 * - Normalizes path case to lowercase on Windows for case-insensitive filesystems while preserving case on Linux/macOS
 */
export function normalizePath(filePath: string, options: { stripDrive?: boolean } = {}): string {
  if (!filePath) return '';
  let norm = path.normalize(filePath).replace(/\\/g, '/');
  if (options.stripDrive) {
    norm = norm.replace(/^[a-zA-Z]:/, '');
  }
  return isWindowsPlatform ? norm.toLowerCase() : norm;
}
