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
    expect(webviewHTML).toContain('doc.designMode = "on"');
  });

  it('should generate syntactically valid JavaScript code inside embedded script tags', () => {
    const sampleHTML = '<h1>Hello World</h1>';
    const webviewHTML = getWebviewContent(sampleHTML);

    const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null = scriptRegex.exec(webviewHTML);
    let scriptCount = 0;

    while (match !== null) {
      const scriptContent = match[1];
      if (scriptContent.trim()) {
        scriptCount++;
        expect(() => {
          const mockGlobals = `
            const acquireVsCodeApi = () => ({ postMessage: () => {} });
            const window = { addEventListener: () => {}, location: { href: 'http://localhost' } };
            const document = { getElementById: () => ({ addEventListener: () => {} }), querySelectorAll: () => [] };
          `;
          new Function(mockGlobals + scriptContent);
        }).not.toThrow();
      }
      match = scriptRegex.exec(webviewHTML);
    }

    expect(scriptCount).toBeGreaterThan(0);
  });

  it('should maintain well-formed HTML document structure without unclosed critical tags', () => {
    const sampleHTML = '<div class="card"><h2>Test</h2></div>';
    const webviewHTML = getWebviewContent(sampleHTML);

    expect(webviewHTML).toMatch(/^<!DOCTYPE html>/i);
    expect(webviewHTML).toContain('<html');
    expect(webviewHTML).toContain('</html>');
    expect(webviewHTML).toContain('<head>');
    expect(webviewHTML).toContain('</head>');
    expect(webviewHTML).toContain('<body');
    expect(webviewHTML).toContain('</body>');
  });
});
