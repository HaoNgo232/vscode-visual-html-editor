const { describe, it } = require('node:test');
const assert = require('assert');
const { clampZoom, calculateNextZoom, formatZoomPercentage } = require('../src/utils/zoomUtils');

describe('Zoom Utilities Test Suite', () => {
  it('should clamp zoom within min and max bounds', () => {
    assert.strictEqual(clampZoom(0.1), 0.3);
    assert.strictEqual(clampZoom(4.0), 3.0);
    assert.strictEqual(clampZoom(1.25), 1.25);
  });

  it('should correctly calculate next zoom level', () => {
    assert.strictEqual(calculateNextZoom(1.0, 0.1), 1.1);
    assert.strictEqual(calculateNextZoom(1.0, -0.1), 0.9);
    assert.strictEqual(calculateNextZoom(3.0, 0.5), 3.0);
  });

  it('should format zoom percentage string correctly', () => {
    assert.strictEqual(formatZoomPercentage(1.0), '100%');
    assert.strictEqual(formatZoomPercentage(1.5), '150%');
    assert.strictEqual(formatZoomPercentage(0.75), '75%');
  });
});
