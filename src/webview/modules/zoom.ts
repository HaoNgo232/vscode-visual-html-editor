import { clampZoom, formatZoomPercentage } from '../../utils/zoomUtils';
import { commandRegistry } from './commandRegistry';
import { getState, updateState } from './state';

export function initZoomModule(iframe: HTMLIFrameElement) {
  const zoomBadge = document.getElementById('zoom-badge');
  const zoomMenu = document.getElementById('zoom-menu');

  function applyZoom() {
    const { currentZoom } = getState();
    const doc =
      iframe.contentDocument || (iframe.contentWindow ? iframe.contentWindow.document : null);
    if (doc?.documentElement) {
      doc.documentElement.style.zoom = currentZoom as any;
    }

    if (zoomBadge) {
      zoomBadge.textContent = formatZoomPercentage(currentZoom);
    }

    if (zoomMenu) {
      zoomMenu.classList.remove('open');
      const items = zoomMenu.querySelectorAll('.menu-item');
      for (let i = 0; i < items.length; i++) {
        const val = Number(items[i].getAttribute('data-value'));
        if (Math.abs(val - currentZoom) < 0.01) {
          items[i].classList.add('active');
        } else {
          items[i].classList.remove('active');
        }
      }
    }
  }

  function setZoom(val: number) {
    const clamped = clampZoom(val);
    updateState({ currentZoom: clamped });
    applyZoom();
  }

  function zoomChange(delta: number) {
    const { currentZoom } = getState();
    setZoom(currentZoom + delta);
  }

  function resetZoom() {
    setZoom(1.0);
  }

  commandRegistry.register({
    id: 'zoom-in',
    group: 'view',
    title: 'Zoom In',
    execute: () => zoomChange(0.1)
  });

  commandRegistry.register({
    id: 'zoom-out',
    group: 'view',
    title: 'Zoom Out',
    execute: () => zoomChange(-0.1)
  });

  commandRegistry.register({
    id: 'reset-zoom',
    group: 'view',
    title: 'Reset Zoom',
    execute: resetZoom
  });

  commandRegistry.register({
    id: 'set-zoom',
    group: 'view',
    title: 'Set Zoom Level',
    execute: (val: number | string) => setZoom(Number(val))
  });

  return { setZoom, zoomChange, resetZoom, applyZoom };
}
