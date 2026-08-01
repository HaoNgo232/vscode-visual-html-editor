import { commandRegistry } from './commandRegistry';

export function initMenuModule(
  moreMenu: HTMLElement,
  helpModal: HTMLElement,
  vscode?: any,
  getCleanHTML?: () => string
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
    id: 'close-help',
    group: 'menu',
    title: 'Close Help Modal',
    execute: () => showHelpModal(false)
  });

  commandRegistry.register({
    id: 'export-pdf',
    group: 'document',
    icon: 'file-pdf',
    title: 'Export to PDF',
    execute: () => {
      closeAllMenus();
      if (vscode && getCleanHTML) {
        vscode.postMessage({
          command: 'exportPdf',
          html: getCleanHTML()
        });
      } else {
        const iframe = document.getElementById('editor-frame') as HTMLIFrameElement;
        if (iframe?.contentWindow) {
          try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          } catch (err: any) {
            console.error('[Export PDF Error]', err);
          }
        }
      }
    }
  });

  return { toggleMenu, closeAllMenus, showHelpModal };
}
