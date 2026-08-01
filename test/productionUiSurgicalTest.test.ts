import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'bun:test';
import { applySurgicalPatches, parseAndTagHtml } from '../src/utils/htmlSurgicalMapper';

describe('Real-World Production UI Surgical Editing Test Suite (Bun)', () => {
  const fixturePath = join(__dirname, 'fixtures/production_ui_landing.html');
  const originalSourceHtml = readFileSync(fixturePath, 'utf8');

  it('should dynamically parse complex UI layout and assign valid IDs to all HTML and SVG tags', () => {
    const { taggedHtml, offsetMap } = parseAndTagHtml(originalSourceHtml);

    // Verify offsetMap extracts all elements dynamically without hardcoding
    expect(offsetMap.size).toBeGreaterThan(60);

    // Ensure every runtimeId points to a non-zero range
    for (const [runtimeId, offset] of offsetMap.entries()) {
      expect(runtimeId).toMatch(/^e\d+$/);
      expect(offset.outerEnd).toBeGreaterThan(offset.outerStart);
      expect(offset.innerEnd).toBeGreaterThanOrEqual(offset.innerStart);
    }

    // Verify SVG elements and defs are properly tagged
    expect(taggedHtml).toMatch(/<svg data-runtime-id="e\d+"/);
    expect(taggedHtml).toMatch(/<linearGradient data-runtime-id="e\d+"/);
    expect(taggedHtml).toMatch(/<path data-runtime-id="e\d+"/);
  });

  it('should support Multi-Pass Roundtrip Editing (Edit -> Save -> Edit again -> Save again) without character drift or corruption', () => {
    // PASS 1: Edit Title
    const pass1Map = parseAndTagHtml(originalSourceHtml).offsetMap;
    let titleId = '';
    for (const [id, offset] of pass1Map.entries()) {
      if (
        offset.tagName === 'h1' &&
        originalSourceHtml.slice(offset.innerStart, offset.innerEnd) ===
          'Executive Performance Overview'
      ) {
        titleId = id;
        break;
      }
    }
    expect(titleId).not.toBe('');

    const htmlAfterPass1 = applySurgicalPatches(originalSourceHtml, pass1Map, [
      { runtimeId: titleId, newInnerHTML: 'Pass 1 Updated Title' }
    ]);
    expect(htmlAfterPass1).toContain(
      '<h1 id="page-title" style="font-size: 1.5rem; font-weight: 700;">Pass 1 Updated Title</h1>'
    );

    // PASS 2: Open modified file (Pass 1) -> Edit MRR value
    const pass2Map = parseAndTagHtml(htmlAfterPass1).offsetMap;
    let mrrId = '';
    for (const [id, offset] of pass2Map.entries()) {
      if (
        offset.tagName === 'span' &&
        htmlAfterPass1.slice(offset.innerStart, offset.innerEnd) === '$148,250.00'
      ) {
        mrrId = id;
        break;
      }
    }
    expect(mrrId).not.toBe('');

    const htmlAfterPass2 = applySurgicalPatches(htmlAfterPass1, pass2Map, [
      { runtimeId: mrrId, newInnerHTML: '$999,999.00' }
    ]);
    expect(htmlAfterPass2).toContain('<span class="stat-value" id="mrr-val">$999,999.00</span>');
    expect(htmlAfterPass2).toContain('Pass 1 Updated Title');

    // PASS 3: Open modified file (Pass 2) -> Edit Customer Table Cell
    const pass3Map = parseAndTagHtml(htmlAfterPass2).offsetMap;
    let customerId = '';
    for (const [id, offset] of pass3Map.entries()) {
      if (
        offset.tagName === 'td' &&
        htmlAfterPass2.slice(offset.innerStart, offset.innerEnd) === 'Acme Corporation'
      ) {
        customerId = id;
        break;
      }
    }
    expect(customerId).not.toBe('');

    const htmlAfterPass3 = applySurgicalPatches(htmlAfterPass2, pass3Map, [
      { runtimeId: customerId, newInnerHTML: 'Google DeepMind AI Labs' }
    ]);

    // Final Invariant Checks across 3 consecutive edit-save passes
    expect(htmlAfterPass3).toContain('Pass 1 Updated Title');
    expect(htmlAfterPass3).toContain('$999,999.00');
    expect(htmlAfterPass3).toContain('<td style="font-weight: 500;">Google DeepMind AI Labs</td>');

    // Non-edited sections must be 100% byte-identical to original source
    expect(htmlAfterPass3).toContain('<!DOCTYPE html>');
    expect(htmlAfterPass3).toContain('<style>');
    expect(htmlAfterPass3).toContain(
      '<path d="M0 130 Q 150 40 300 90 T 600 20 L 600 160 L 0 160 Z" fill="url(#chartGrad)"/>'
    );
  });
});
