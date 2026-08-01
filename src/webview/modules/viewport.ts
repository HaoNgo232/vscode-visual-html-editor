import { commandRegistry } from './commandRegistry';
import { updateState, type ViewportMode } from './state';

export function initViewportModule(wrapper: HTMLElement) {
  const iconElem = document.getElementById('viewport-icon');
  const labelElem = document.getElementById('viewport-label');
  const viewportMenu = document.getElementById('viewport-menu');

  function setViewport(mode: ViewportMode) {
    updateState({ viewport: mode });

    wrapper.classList.remove('viewport-desktop', 'viewport-tablet', 'viewport-mobile');
    wrapper.classList.add(`viewport-${mode}`);

    if (iconElem) {
      iconElem.className = 'codicon';
      if (mode === 'desktop') {
        iconElem.classList.add('codicon-device-desktop');
      } else if (mode === 'tablet') {
        iconElem.classList.add('codicon-device-tablet');
      } else if (mode === 'mobile') {
        iconElem.classList.add('codicon-device-mobile');
      }
    }

    if (labelElem) {
      if (mode === 'desktop') labelElem.textContent = 'Desktop';
      else if (mode === 'tablet') labelElem.textContent = 'Tablet';
      else if (mode === 'mobile') labelElem.textContent = 'Mobile';
    }

    if (viewportMenu) {
      viewportMenu.classList.remove('open');
      const items = viewportMenu.querySelectorAll('.menu-item');
      for (let i = 0; i < items.length; i++) {
        const itemVal = items[i].getAttribute('data-value');
        if (itemVal === mode) {
          items[i].classList.add('active');
        } else {
          items[i].classList.remove('active');
        }
      }
    }
  }

  commandRegistry.register({
    id: 'set-viewport',
    group: 'viewport',
    title: 'Set Viewport Size',
    execute: (mode: ViewportMode) => setViewport(mode)
  });

  return { setViewport };
}
