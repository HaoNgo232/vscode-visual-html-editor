import { commandRegistry } from './commandRegistry';

export function initMenuModule(
  moreMenu: HTMLElement,
  helpModal: HTMLElement
) {
  function closeAllMenus() {
    const menus = document.querySelectorAll('.popover-menu');
    for (let i = 0; i < menus.length; i++) {
      menus[i].classList.remove('open');
    }
  }

  function toggleMenu(menu: HTMLElement, show?: boolean) {
    const isVisible = menu.classList.contains('open');
    const shouldShow = show !== undefined ? show : !isVisible;
    closeAllMenus();
    if (shouldShow) {
      menu.classList.add('open');
    }
  }

  function showHelpModal(show = true) {
    if (show) {
      helpModal.classList.add('open');
    } else {
      helpModal.classList.remove('open');
    }
    closeAllMenus();
  }

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.menu-container')) {
      closeAllMenus();
    }
  });

  commandRegistry.register({
    id: 'toggle-menu',
    group: 'menu',
    icon: 'ellipsis',
    title: 'Toggle More Menu',
    execute: (show?: boolean) => toggleMenu(moreMenu, show)
  });

  const viewportMenu = document.getElementById('viewport-menu');
  if (viewportMenu) {
    commandRegistry.register({
      id: 'toggle-viewport-menu',
      group: 'menu',
      title: 'Toggle Viewport Menu',
      execute: (show?: boolean) => toggleMenu(viewportMenu, show)
    });
  }

  const zoomMenu = document.getElementById('zoom-menu');
  if (zoomMenu) {
    commandRegistry.register({
      id: 'toggle-zoom-menu',
      group: 'menu',
      title: 'Toggle Zoom Menu',
      execute: (show?: boolean) => toggleMenu(zoomMenu, show)
    });
  }

  commandRegistry.register({
    id: 'show-help',
    group: 'menu',
    icon: 'question',
    title: 'Shortcuts & Help',
    execute: () => showHelpModal(true)
  });

  commandRegistry.register({
    id: 'reload',
    group: 'document',
    icon: 'refresh',
    title: 'Reload Document',
    execute: () => {
      window.location.reload();
    }
  });

  return { toggleMenu, closeAllMenus, showHelpModal };
}
