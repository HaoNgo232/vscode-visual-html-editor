import { describe, expect, it } from 'bun:test';
import { clampZoom, formatZoomPercentage } from '../src/utils/zoomUtils';

describe('Zoom Utilities Test Suite (Bun)', () => {
  it('should clamp zoom within min and max bounds', () => {
    expect(clampZoom(0.1)).toBe(0.3);
    expect(clampZoom(4.0)).toBe(3.0);
    expect(clampZoom(1.25)).toBe(1.25);
  });

  it('should format zoom percentage string correctly', () => {
    expect(formatZoomPercentage(1.0)).toBe('100%');
    expect(formatZoomPercentage(1.5)).toBe('150%');
    expect(formatZoomPercentage(0.75)).toBe('75%');
  });
});
