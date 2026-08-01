import { commandRegistry } from './commandRegistry';
import { updateState } from './state';

export function initModeModule(iframe: HTMLIFrameElement) {
  function setMode(mode: 'edit' | 'preview') {
    updateState({ mode });

    const doc =
      iframe.contentDocument || (iframe.contentWindow ? iframe.contentWindow.document : null);
    if (doc) {
      try {
        doc.designMode = mode === 'edit' ? 'on' : 'off';
        if (mode === 'preview') {
          const activeElems = doc.querySelectorAll('.vhe-editing-active');
          for (let i = 0; i < activeElems.length; i++) {
            activeElems[i].classList.remove('vhe-editing-active');
          }
        }
      } catch (e) {
        console.warn('[Mode] Failed to set designMode:', e);
      }
    }

    const editBtn = document.getElementById('btn-mode-edit');
    const previewBtn = document.getElementById('btn-mode-preview');

    if (editBtn && previewBtn) {
      if (mode === 'edit') {
        editBtn.classList.add('active');
        previewBtn.classList.remove('active');
      } else {
        previewBtn.classList.add('active');
        editBtn.classList.remove('active');
      }
    }
  }

  commandRegistry.register({
    id: 'mode-edit',
    group: 'mode',
    icon: 'edit',
    title: 'Edit Mode',
    execute: () => setMode('edit')
  });

  commandRegistry.register({
    id: 'mode-preview',
    group: 'mode',
    icon: 'eye',
    title: 'Preview Mode',
    execute: () => setMode('preview')
  });

  return { setMode };
}
