import { describe, expect, it } from 'bun:test';
import { applySurgicalPatches, parseAndTagHtml } from '../src/utils/htmlSurgicalMapper';

describe('HTML Surgical Mapper Utility Test Suite (Bun)', () => {
  it('should inject data-runtime-id into opening HTML tags', () => {
    const inputHtml = '<section><h1>Hello World</h1><p>Description</p></section>';
    const { taggedHtml, offsetMap } = parseAndTagHtml(inputHtml);

    expect(taggedHtml).toContain('<section data-runtime-id="e1">');
    expect(taggedHtml).toContain('<h1 data-runtime-id="e2">Hello World</h1>');
    expect(taggedHtml).toContain('<p data-runtime-id="e3">Description</p>');
    expect(offsetMap.size).toBe(3);
  });

  it('should accurately calculate inner and outer offset ranges', () => {
    const inputHtml = '<div><p>Sample</p></div>';
    const { offsetMap } = parseAndTagHtml(inputHtml);

    const divOffset = offsetMap.get('e1');
    const pOffset = offsetMap.get('e2');

    expect(divOffset?.tagName).toBe('div');
    expect(divOffset?.outerStart).toBe(0);
    expect(divOffset?.outerEnd).toBe(24);
    expect(divOffset?.innerStart).toBe(5);
    expect(divOffset?.innerEnd).toBe(18);

    expect(pOffset?.tagName).toBe('p');
    expect(pOffset?.outerStart).toBe(5);
    expect(pOffset?.outerEnd).toBe(18);
    expect(pOffset?.innerStart).toBe(8);
    expect(pOffset?.innerEnd).toBe(14);
  });

  it('should preserve HTML comments and not inject IDs into comments', () => {
    const inputHtml = '<!-- Header comment --><div>Text</div>';
    const { taggedHtml, offsetMap } = parseAndTagHtml(inputHtml);

    expect(taggedHtml).toContain('<!-- Header comment -->');
    expect(taggedHtml).not.toContain('data-runtime-id="e1" Header');
    expect(taggedHtml).toContain('<div data-runtime-id="e1">Text</div>');
    expect(offsetMap.size).toBe(1);
  });

  it('should perform surgical innerHTML replacement without modifying original document formatting or comments', () => {
    const originalHtml = `<!DOCTYPE html>
<!-- Author Note -->
<section class="card">
  <h1>Nguyễn Văn A</h1>
  <p>Frontend Developer</p>
</section>`;

    const { offsetMap } = parseAndTagHtml(originalHtml);

    const updated = applySurgicalPatches(originalHtml, offsetMap, [
      { runtimeId: 'e2', newInnerHTML: 'Nguyễn Văn B' }
    ]);

    expect(updated).toBe(`<!DOCTYPE html>
<!-- Author Note -->
<section class="card">
  <h1>Nguyễn Văn B</h1>
  <p>Frontend Developer</p>
</section>`);
  });

  it('should support multiple non-overlapping surgical changes simultaneously', () => {
    const originalHtml = '<section><h1>Name</h1><p>Role</p></section>';
    const { offsetMap } = parseAndTagHtml(originalHtml);

    const updated = applySurgicalPatches(originalHtml, offsetMap, [
      { runtimeId: 'e2', newInnerHTML: 'Hảo Ngo' },
      { runtimeId: 'e3', newInnerHTML: 'Senior Software Engineer' }
    ]);

    expect(updated).toBe('<section><h1>Hảo Ngo</h1><p>Senior Software Engineer</p></section>');
  });
});
