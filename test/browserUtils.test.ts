import { describe, expect, it } from 'bun:test';
import { findChromeExecutable } from '../src/utils/browserUtils';

describe('Browser Detection & Executable Finder Test Suite (Bun)', () => {
  it('should return a string or null without throwing any exceptions', () => {
    const result = findChromeExecutable(null);
    expect(typeof result === 'string' || result === null).toBe(true);
  });

  it('should respect custom executablePath from vscode configuration if file exists', () => {
    const mockVscodeApi = {
      workspace: {
        getConfiguration: (_section: string) => ({
          get: (key: string) => (key === 'executablePath' ? '/bin/sh' : '')
        })
      }
    };
    const result = findChromeExecutable(mockVscodeApi);
    expect(result).toBe('/bin/sh');
  });

  it('should ignore custom executablePath if path does not exist on disk', () => {
    const mockVscodeApi = {
      workspace: {
        getConfiguration: (_section: string) => ({
          get: (key: string) => (key === 'executablePath' ? '/non/existent/path/to/chrome' : '')
        })
      }
    };
    const result = findChromeExecutable(mockVscodeApi);
    expect(result).not.toBe('/non/existent/path/to/chrome');
  });
});
