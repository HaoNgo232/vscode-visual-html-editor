import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applySurgicalPatches, parseAndTagHtml } from '../src/utils/htmlSurgicalMapper';

describe('Complex Document Surgical Editing Test Suite (Bun)', () => {
  const fixturePath = join(__dirname, 'fixtures/complex_demo.html');
  const rawHtml = readFileSync(fixturePath, 'utf8');

  it('should parse and tag complex HTML with nested elements, SVGs, and comments', () => {
    const { taggedHtml, offsetMap } = parseAndTagHtml(rawHtml);

    expect(taggedHtml).toContain('<!-- Header Section -->');
    expect(taggedHtml).toContain('<header data-runtime-id="e6"');
    expect(taggedHtml).toContain('<h1 data-runtime-id="e7" class="title">');
    expect(taggedHtml).toContain('<svg data-runtime-id="e22"');
    expect(taggedHtml).toContain('<circle data-runtime-id="e23"');
    expect(taggedHtml).toContain('<td data-runtime-id="e35" class="user-name">');

    expect(offsetMap.size).toBe(42);
  });

  it('should surgically edit multiple non-adjacent nested elements in complex document without corrupting indentation or comments', () => {
    const { offsetMap } = parseAndTagHtml(rawHtml);

    // Find runtimeIds for specific elements
    let h1RuntimeId = '';
    let nameRuntimeId = '';
    let roleRuntimeId = '';

    for (const [id, offset] of offsetMap.entries()) {
      if (offset.tagName === 'h1') h1RuntimeId = id;
      if (
        offset.tagName === 'td' &&
        rawHtml.slice(offset.innerStart, offset.innerEnd) === 'Alex Smith'
      ) {
        nameRuntimeId = id;
      }
      if (
        offset.tagName === 'td' &&
        rawHtml.slice(offset.innerStart, offset.innerEnd) === 'Frontend Engineer'
      ) {
        roleRuntimeId = id;
      }
    }

    expect(h1RuntimeId).not.toBe('');
    expect(nameRuntimeId).not.toBe('');
    expect(roleRuntimeId).not.toBe('');

    // Apply surgical patches
    const patched = applySurgicalPatches(rawHtml, offsetMap, [
      { runtimeId: h1RuntimeId, newInnerHTML: 'Updated Visual Title' },
      { runtimeId: nameRuntimeId, newInnerHTML: 'Nguyen Van A' },
      { runtimeId: roleRuntimeId, newInnerHTML: 'Lead Fullstack Architect' }
    ]);

    expect(patched).toContain('<h1 class="title">Updated Visual Title</h1>');
    expect(patched).toContain('<td class="user-name">Nguyen Van A</td>');
    expect(patched).toContain('<td class="user-role">Lead Fullstack Architect</td>');

    // Verify non-edited sections remain pristine
    expect(patched).toContain('<!-- Header Section -->');
    expect(patched).toContain('data-rule="a < b &amp;&amp; c > d"');
    expect(patched).toContain('<circle cx="12" cy="12" r="10" stroke-width="2" />');
    expect(patched).toContain('Sarah Connor');
  });
});
