import { describe, expect, it } from 'bun:test';
import { applySurgicalPatches, parseAndTagHtml } from '../src/utils/htmlSurgicalMapper';
import { getWebviewContent } from '../src/webview/editorContent';

describe('Save Trigger Rollback & Fallback Protection Test Suite', () => {
  describe('1. AST & Mapper Surgical Patch Abort & Rollback Guards', () => {
    it('should abort surgical patch and return originalHtml when runtimeId is missing/stale in offsetMap', () => {
      const html = '<article><h1>Title</h1><p>Content</p></article>';
      const { offsetMap } = parseAndTagHtml(html);

      // Attempt to patch using a stale/non-existent runtimeId
      const patched = applySurgicalPatches(html, offsetMap, [
        { runtimeId: 'stale_id_9999', newInnerHTML: 'Modified Content' }
      ]);

      // Must return originalHtml untouched to force host to roll back to fallbackHtml
      expect(patched).toBe(html);
    });

    it('should abort surgical patch and return originalHtml when tag splitting occurs', () => {
      const html = '<section><h2>Header</h2></section>';
      const { offsetMap } = parseAndTagHtml(html);
      const h2Offset = Array.from(offsetMap.values()).find((e) => e.tagName === 'h2');

      expect(h2Offset).toBeDefined();

      if (h2Offset) {
        // Simulating user hitting Enter key resulting in a split closing </h2> tag inside innerHTML
        const patched = applySurgicalPatches(html, offsetMap, [
          { runtimeId: h2Offset.runtimeId, newInnerHTML: 'Header</h2><h2>Subheader' }
        ]);

        // Must return originalHtml untouched to force host to roll back to fallbackHtml
        expect(patched).toBe(html);
      }
    });

    it('should fall back to fallbackHtml when surgical patch returns originalHtml untouched', () => {
      const originalSourceHtml = '<div class="card">Old Content</div>';
      const fallbackHtml = '<div class="card">New Content Added By User</div>';
      const { offsetMap } = parseAndTagHtml(originalSourceHtml);

      // Simulate invalid/stale change list that causes applySurgicalPatches to abort
      const changes = [{ runtimeId: 'invalid_id', newInnerHTML: 'New Content Added By User' }];
      const patched = applySurgicalPatches(originalSourceHtml, offsetMap, changes);

      // Emulate Extension Host fallback decision logic from extension.ts
      let finalHtml = fallbackHtml;
      if (patched && patched !== originalSourceHtml) {
        finalHtml = patched;
      }

      // Must roll back to fallbackHtml cleanly
      expect(finalHtml).toBe(fallbackHtml);
    });
  });

  describe('2. Webview Save Failure State & Rollback Protection', () => {
    it('should contain fallbackHtml payload in saveSurgical message trigger', () => {
      const html = getWebviewContent('<div>Test</div>');

      expect(html).toContain('saveSurgical');
      expect(html).toContain('fallbackHtml');
    });

    it('should contain saveCompleted listener with error state handling', () => {
      const html = getWebviewContent('<div>Test</div>');

      expect(html).toContain('saveCompleted');
      expect(html).toContain('dirtyRuntimeIds.clear()');
    });
  });
});
