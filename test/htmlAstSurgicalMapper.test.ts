import { describe, expect, it } from 'bun:test';
import { applySurgicalPatches, parseAndTagHtml } from '../src/utils/htmlSurgicalMapper';

describe('AST HTML Surgical Mapper Test Suite (Bun)', () => {
  it('should correctly parse HTML attributes containing < or > expressions without breaking tag boundaries', () => {
    const complexHtml = `<div :class="{ 'active': count < 5 }" data-expr="a > b"><h1 class="title">Hello</h1></div>`;
    const { taggedHtml, offsetMap } = parseAndTagHtml(complexHtml);

    expect(taggedHtml).toContain('data-runtime-id="e1"');
    expect(taggedHtml).toContain('data-runtime-id="e2"');

    expect(offsetMap.has('e1')).toBe(true);
    expect(offsetMap.has('e2')).toBe(true);

    const h1Offset = offsetMap.get('e2');
    expect(h1Offset?.tagName).toBe('h1');

    const patched = applySurgicalPatches(complexHtml, offsetMap, [
      { runtimeId: 'e2', newInnerHTML: 'Updated Title' }
    ]);

    expect(patched).toBe(
      `<div :class="{ 'active': count < 5 }" data-expr="a > b"><h1 class="title">Updated Title</h1></div>`
    );
  });

  it('should accurately calculate line and column numbers for multi-line HTML elements', () => {
    const multiLineHtml = `<!DOCTYPE html>
<html>
  <head>
    <title>Test Page</title>
  </head>
  <body>
    <main class="content">
      <h1>Heading</h1>
    </main>
  </body>
</html>`;

    const { offsetMap } = parseAndTagHtml(multiLineHtml);

    // Find main element
    let mainOffset: any = null;
    for (const offset of offsetMap.values()) {
      if (offset.tagName === 'main') {
        mainOffset = offset;
        break;
      }
    }

    expect(mainOffset).not.toBeNull();
    expect(mainOffset.startLine).toBe(7);
    expect(mainOffset.startCol).toBe(4); // 4 spaces indent before <main>
  });

  it('should handle complex inline SVG elements with nested paths without breaking mapping', () => {
    const svgHtml = `<div class="icon-container">
  <svg viewBox="0 0 100 100" class="icon">
    <!-- SVG Comment -->
    <path d="M10 10 L90 90" />
    <g id="group1"><circle cx="50" cy="50" r="40"/></g>
  </svg>
  <span class="label">Icon Label</span>
</div>`;

    const { offsetMap } = parseAndTagHtml(svgHtml);

    // Find span element
    let spanOffset: any = null;
    for (const offset of offsetMap.values()) {
      if (offset.tagName === 'span') {
        spanOffset = offset;
        break;
      }
    }

    expect(spanOffset).not.toBeNull();

    const patched = applySurgicalPatches(svgHtml, offsetMap, [
      { runtimeId: spanOffset.runtimeId, newInnerHTML: 'Updated Label' }
    ]);

    expect(patched).toContain('<span class="label">Updated Label</span>');
    expect(patched).toContain('<!-- SVG Comment -->');
  });

  it('should filter out nested child element changes to avoid duplicate/corrupted HTML replacement', () => {
    const originalHtml = `<html><body><div class="parent"><p class="child">Original Text</p></div></body></html>`;
    const { offsetMap } = parseAndTagHtml(originalHtml);

    const divOffset = Array.from(offsetMap.values()).find((e) => e.tagName === 'div');
    const pOffset = Array.from(offsetMap.values()).find((e) => e.tagName === 'p');

    expect(divOffset).toBeDefined();
    expect(pOffset).toBeDefined();

    if (divOffset && pOffset) {
      // Both parent (div) and child (p) passed in changes list
      const patched = applySurgicalPatches(originalHtml, offsetMap, [
        { runtimeId: divOffset.runtimeId, newInnerHTML: '<p class="child">Updated Text</p>' },
        { runtimeId: pOffset.runtimeId, newInnerHTML: 'Updated Text' }
      ]);

      expect(patched).toBe(
        `<html><body><div class="parent"><p class="child">Updated Text</p></div></body></html>`
      );
      expect(patched).not.toContain('</body></html>y>');
    }
  });

  it('should handle multi-level deep nesting (5 levels) and retain only top-most ancestor', () => {
    const deepHtml = `<div id="l1"><section id="l2"><article id="l3"><p id="l4"><span id="l5">Deep Text</span></p></article></section></div>`;
    const { offsetMap } = parseAndTagHtml(deepHtml);

    const l1 = Array.from(offsetMap.values()).find((e) => e.outerStart === deepHtml.indexOf('<div'));
    const l2 = Array.from(offsetMap.values()).find((e) => e.outerStart === deepHtml.indexOf('<section'));
    const l3 = Array.from(offsetMap.values()).find((e) => e.outerStart === deepHtml.indexOf('<article'));
    const l4 = Array.from(offsetMap.values()).find((e) => e.outerStart === deepHtml.indexOf('<p'));
    const l5 = Array.from(offsetMap.values()).find((e) => e.outerStart === deepHtml.indexOf('<span'));

    expect(l1).toBeDefined();
    expect(l5).toBeDefined();

    if (l1 && l2 && l3 && l4 && l5) {
      // Pass all 5 levels as dirty simultaneously
      const patched = applySurgicalPatches(deepHtml, offsetMap, [
        { runtimeId: l1.runtimeId, newInnerHTML: '<section id="l2"><article id="l3"><p id="l4"><span id="l5">Updated Deep Text</span></p></article></section>' },
        { runtimeId: l2.runtimeId, newInnerHTML: '<article id="l3"><p id="l4"><span id="l5">Updated Deep Text</span></p></article>' },
        { runtimeId: l3.runtimeId, newInnerHTML: '<p id="l4"><span id="l5">Updated Deep Text</span></p>' },
        { runtimeId: l4.runtimeId, newInnerHTML: '<span id="l5">Updated Deep Text</span>' },
        { runtimeId: l5.runtimeId, newInnerHTML: 'Updated Deep Text' }
      ]);

      expect(patched).toBe(
        `<div id="l1"><section id="l2"><article id="l3"><p id="l4"><span id="l5">Updated Deep Text</span></p></article></section></div>`
      );
    }
  });

  it('should return originalHtml when newInnerHTML contains a split closing tag to trigger safe full-document fallback', () => {
    const html = `<div><p class="target">Paragraph text</p></div>`;
    const { offsetMap } = parseAndTagHtml(html);
    const pOffset = Array.from(offsetMap.values()).find((e) => e.tagName === 'p');

    expect(pOffset).toBeDefined();

    if (pOffset) {
      // User pressed Enter inside paragraph, creating a closing </p> inside newInnerHTML
      const patched = applySurgicalPatches(html, offsetMap, [
        { runtimeId: pOffset.runtimeId, newInnerHTML: 'Paragraph text</p><p class="target">New paragraph' }
      ]);

      // Returns originalHtml untouched to force fallbackHtml!
      expect(patched).toBe(html);
    }
  });
});
