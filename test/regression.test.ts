import { describe, expect, it } from 'bun:test';
import { clampZoom, formatZoomPercentage } from '../src/utils/zoomUtils';
import { getWebviewContent } from '../src/webview/editorContent';

describe('Regression & Edge Cases Test Suite (Bun)', () => {
  describe('1. Script Escaping & Anti-Collision Tests', () => {
    it('should safely escape closing script tags inside HTML content to prevent webview crashes', () => {
      const htmlWithScript =
        '<html><head><script>console.log("</script>");</script></head><body>Test</body></html>';
      const result = getWebviewContent(htmlWithScript);

      expect(result).not.toContain('</script>");');
      expect(result).toContain('\\u003c/script\\u003e');
    });

    it('should handle special unicode line terminators (\\u2028, \\u2029)', () => {
      const htmlWithLineTerminators = '<div>Line\u2028Break\u2029End</div>';
      const result = getWebviewContent(htmlWithLineTerminators);

      expect(result).not.toContain('\u2028');
      expect(result).not.toContain('\u2029');
      expect(result).toContain('\\u2028');
      expect(result).toContain('\\u2029');
    });
  });

  describe('2. Base URI & Relative Resource Resolution Tests', () => {
    it('should inject baseUri when provided', () => {
      const sampleUri = 'vscode-webview://authority/path/to/folder/';
      const result = getWebviewContent('<h1>Hello</h1>', sampleUri);

      expect(result).toContain(JSON.stringify(sampleUri));
      expect(result).toContain('baseElem.href = baseUri');
    });

    it('should handle null baseUri gracefully without crashing', () => {
      const result = getWebviewContent('<h1>Hello</h1>', null);

      expect(result).toContain('baseUri = null;');
    });
  });

  describe('3. Template Placeholder Integrity Tests', () => {
    it('should leave no unreplaced template placeholders', () => {
      const result = getWebviewContent('<p>Simple HTML</p>', 'http://localhost/');

      expect(result).not.toContain('/* __CODICON_PLACEHOLDER__ */');
      expect(result).not.toContain('/* __STYLE_PLACEHOLDER__ */');
      expect(result).not.toContain('/* __SCRIPT_PLACEHOLDER__ */');
    });
  });

  describe('4. Zoom Bound Clamping & Precision Tests', () => {
    it('should clamp zoom below minimum limit (0.3x)', () => {
      expect(clampZoom(0.0)).toBe(0.3);
      expect(clampZoom(-1.5)).toBe(0.3);
      expect(clampZoom(0.29)).toBe(0.3);
    });

    it('should clamp zoom above maximum limit (3.0x)', () => {
      expect(clampZoom(3.1)).toBe(3.0);
      expect(clampZoom(10.0)).toBe(3.0);
    });

    it('should format percentage displays accurately', () => {
      expect(formatZoomPercentage(1.0)).toBe('100%');
      expect(formatZoomPercentage(1.25)).toBe('125%');
      expect(formatZoomPercentage(0.5)).toBe('50%');
      expect(formatZoomPercentage(3.0)).toBe('300%');
    });
  });

  describe('5. UI Error Boundary & Diagnostics Integrity Tests', () => {
    it('should include error boundary elements & methods in generated webview', () => {
      const result = getWebviewContent('<div>Content</div>');

      expect(result).toContain('id="error-overlay"');
      expect(result).toContain('id="error-details"');
      expect(result).toContain('showError');
      expect(result).toContain('dismiss-error');
      expect(result).toContain('copy-error');
      expect(result).toContain('window.onerror');
      expect(result).toContain('window.onunhandledrejection');
    });
  });

  describe('6. Save & Zoom Cleanup Protocol Tests', () => {
    it('should contain temporary zoom stripping and sanitizeNode logic prior to save', () => {
      const result = getWebviewContent('<div>Content</div>');

      expect(result).toContain('doc.documentElement.style.zoom = ""');
      expect(result).toContain('currentHTML');
      expect(result).toContain('sanitizeNode');
      expect(result).toContain('removeAttribute("style")');
      expect(result).toContain('doc.documentElement.style.zoom = originalZoom');
    });
  });

  describe('7. Unsaved Changes Guard & Dirty State Tests', () => {
    it('should contain dirty state tracking and beforeunload listeners', () => {
      const result = getWebviewContent('<div>Content</div>');

      expect(result).toContain('status-badge');
      expect(result).toContain('status-unsaved');
      expect(result).toContain('setDirtyState');
      expect(result).toContain('window.onbeforeunload');
      expect(result).toContain('command: "setDirty"');
    });
  });

  describe('8. Auto Save Toggle & Debounce Protocol Tests', () => {
    it('should contain Auto Save toggle UI elements & checked state by default', () => {
      const result = getWebviewContent('<div>Content</div>');

      expect(result).toContain('id="auto-save-toggle"');
      expect(result).toContain('toggle-auto-save');
      expect(result).toContain('toggleAutoSave');
      expect(result).toContain('checked');
    });

    it('should contain debounced auto save logic with 1000ms delay', () => {
      const result = getWebviewContent('<div>Content</div>');

      expect(result).toContain('DEBOUNCE_DELAY = 1000');
      expect(result).toContain('debounce');
      expect(result).toContain('debouncedSave');
      expect(result).toContain('debouncedSave.cancel()');
    });
  });

  describe('9. Export PDF Protocol Tests', () => {
    it('should contain export-pdf command registration and print trigger', () => {
      const result = getWebviewContent('<div>Content</div>');

      expect(result).toContain('export-pdf');
      expect(result).toContain('print()');
    });
  });

  describe('10. Scoped Ctrl+A Text Selection Protocol Tests', () => {
    it('should contain scoped Ctrl+A selection handler for active element', () => {
      const result = getWebviewContent('<div>Content</div>');

      expect(result).toContain('.vhe-editing-active');
      expect(result).toContain('selectNodeContents');
      expect(result).toContain('getSelection');
    });
  });

  describe('11. Native DesignMode Undo Preservation Protocol Tests', () => {
    it('should preserve native designMode undo buffer on saveCompleted by avoiding iframe reload', () => {
      const result = getWebviewContent('<div>Content</div>');

      expect(result).toContain('saveCompleted');
      expect(result).not.toContain('updateIframeContent(message.taggedHtml)');
    });
  });
});
