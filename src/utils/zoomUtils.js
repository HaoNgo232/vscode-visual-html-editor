/**
 * Utility functions for zoom level calculations and clamping.
 */

function clampZoom(zoom, min = 0.3, max = 3.0) {
  const rounded = Math.round(zoom * 100) / 100;
  return Math.max(min, Math.min(max, rounded));
}

function calculateNextZoom(currentZoom, delta, min = 0.3, max = 3.0) {
  return clampZoom(currentZoom + delta, min, max);
}

function formatZoomPercentage(zoom) {
  return `${Math.round(clampZoom(zoom) * 100)}%`;
}

module.exports = {
  clampZoom,
  calculateNextZoom,
  formatZoomPercentage
};
