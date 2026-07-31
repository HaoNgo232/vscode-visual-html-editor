/**
 * Utility functions for zoom level calculations and clamping.
 */

export function clampZoom(zoom: number, min: number = 0.3, max: number = 3.0): number {
  const rounded = Math.round(zoom * 100) / 100;
  return Math.max(min, Math.min(max, rounded));
}

export function calculateNextZoom(currentZoom: number, delta: number, min: number = 0.3, max: number = 3.0): number {
  return clampZoom(currentZoom + delta, min, max);
}

export function formatZoomPercentage(zoom: number): string {
  return `${Math.round(clampZoom(zoom) * 100)}%`;
}
