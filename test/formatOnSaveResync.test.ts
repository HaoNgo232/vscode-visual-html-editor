import { describe, expect, it } from 'bun:test';
import { applySurgicalPatches, parseAndTagHtml } from '../src/utils/htmlSurgicalMapper';
import { getWebviewContent } from '../src/webview/editorContent';

describe('Format On Save & Post-Save Re-sync Test Suite (Bun)', () => {
  it('should successfully handle surgical patches after document reformatting by formatters', () => {
    // 1. Initial HTML source before save
    const initialHtml = '<div><h1 class="title">Hello World</h1><p>Description text</p></div>';
    const { offsetMap: map1 } = parseAndTagHtml(initialHtml);

    // 2. User edits h1 tag via webview
    const edit1 = applySurgicalPatches(initialHtml, map1, [
      { runtimeId: 'e2', newInnerHTML: 'Updated Title' }
    ]);
    expect(edit1).toBe('<div><h1 class="title">Updated Title</h1><p>Description text</p></div>');

    // 3. Formatter runs on save (e.g. adding newlines, indenting tags, formatting attributes)
    const formattedByPrettier = `<div>
  <h1 class="title">
    Updated Title
  </h1>
  <p>Description text</p>
</div>`;

    // 4. Post-save re-sync calculates new offset map on formatted HTML
    const { offsetMap: map2 } = parseAndTagHtml(formattedByPrettier);

    // 5. Subsequent edit on paragraph tag using re-synced offset map
    const edit2 = applySurgicalPatches(formattedByPrettier, map2, [
      { runtimeId: 'e3', newInnerHTML: 'New paragraph content' }
    ]);

    expect(edit2).toContain('<p>New paragraph content</p>');
    expect(edit2).toContain('<h1 class="title">');
    expect(edit2).toContain('Updated Title');
  });

  it('should include saveCompleted protocol handler in generated webview JS', () => {
    const webviewContent = getWebviewContent('<div>Test</div>');
    expect(webviewContent).toContain('saveCompleted');
    expect(webviewContent).toContain('dirtyRuntimeIds.clear()');
  });
});
