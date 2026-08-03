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

  function getExportDimensions(): { width: number; height: number } {
    const iframe = document.getElementById('editor-frame') as HTMLIFrameElement;
    let width = 1200;
    let height = 800;

    if (iframe) {
      width = iframe.clientWidth || width;
      try {
        const doc = iframe.contentWindow?.document;
        if (doc) {
          const scrollH = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
          if (scrollH > 0) {
            height = scrollH;
          }
        }
      } catch (err) {
        console.warn(
          '[Export Dimensions] Failed to read iframe document height, falling back:',
          err
        );
        height = iframe.clientHeight || height;
      }
    }
    return { width, height };
  }

  commandRegistry.register({
    id: 'export-pdf',
    group: 'document',
    icon: 'file-pdf',
    title: 'Export to PDF',
    execute: () => {
      closeAllMenus();
      const dims = getExportDimensions();
      if (vscode && getCleanHTML) {
        vscode.postMessage({
          command: 'exportPdf',
          html: getCleanHTML(),
          width: dims.width,
          height: dims.height
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

  commandRegistry.register({
    id: 'export-image',
    group: 'document',
    icon: 'file-media',
    title: 'Export to Image',
    execute: () => {
      closeAllMenus();
      const dims = getExportDimensions();
      if (vscode && getCleanHTML) {
        vscode.postMessage({
          command: 'exportImage',
          html: getCleanHTML(),
          width: dims.width,
          height: dims.height
        });
      }
    }
  });

  return { toggleMenu, closeAllMenus, showHelpModal };
}
