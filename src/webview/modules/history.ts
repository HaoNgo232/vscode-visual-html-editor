import { commandRegistry } from './commandRegistry';

export function initHistoryModule(iframe: HTMLIFrameElement) {
  function undo() {
    const doc =
      iframe.contentDocument || (iframe.contentWindow ? iframe.contentWindow.document : null);
    if (doc) {
      (doc as any).execCommand('undo', false);
    }
  }

  function redo() {
    const doc =
      iframe.contentDocument || (iframe.contentWindow ? iframe.contentWindow.document : null);
    if (doc) {
      (doc as any).execCommand('redo', false);
    }
  }

  commandRegistry.register({
    id: 'undo',
    group: 'history',
    icon: 'undo',
    title: 'Undo (Ctrl+Z)',
    execute: undo
  });

  commandRegistry.register({
    id: 'redo',
    group: 'history',
    icon: 'redo',
    title: 'Redo (Ctrl+Y)',
    execute: redo
  });

  return {
    undo,
    redo
  };
}
