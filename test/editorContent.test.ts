import { describe, expect, it } from 'bun:test';
import { getWebviewContent } from '../src/webview/editorContent';

describe('Webview Editor Content Test Suite (Bun)', () => {
  it('should generate valid webview HTML containing initial content & error boundary', () => {
    const sampleHTML = '<h1>Hello World</h1>';
    const webviewHTML = getWebviewContent(sampleHTML);

    expect(webviewHTML).toContain('<!DOCTYPE html>');
    expect(webviewHTML).toContain('acquireVsCodeApi');
    expect(webviewHTML).toContain('Hello World');
    expect(webviewHTML).toContain('error-overlay');
    expect(webviewHTML).toContain('showError');
    expect(webviewHTML).toContain("doc.designMode = 'on'");
  });
});
