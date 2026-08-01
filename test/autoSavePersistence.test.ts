import { describe, expect, it } from 'bun:test';
import { getWebviewContent } from '../src/webview/editorContent';

describe('Auto Save Persistence & Protocol Test Suite (Bun)', () => {
  it('should inject autoSaveEnabled state into webview script when enabled is true', () => {
    const html = getWebviewContent('<h1>Test</h1>', null, true);
    expect(html).toContain('initialAutoSaveEnabled = true');
    expect(html).not.toContain('__AUTO_SAVE_ENABLED_PLACEHOLDER__');
  });

  it('should inject autoSaveEnabled state into webview script when enabled is false', () => {
    const html = getWebviewContent('<h1>Test</h1>', null, false);
    expect(html).toContain('initialAutoSaveEnabled = false');
    expect(html).not.toContain('__AUTO_SAVE_ENABLED_PLACEHOLDER__');
  });

  it('should contain toggleAutoSave postMessage protocol to persist state', () => {
    const html = getWebviewContent('<h1>Test</h1>');
    expect(html).toContain('toggleAutoSave');
  });
});
