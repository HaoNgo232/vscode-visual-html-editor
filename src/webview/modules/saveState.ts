import { debounce } from '../../utils/debounceUtils';
import { commandRegistry } from './commandRegistry';
import { getState, type SaveStatus, updateState } from './state';

export function initSaveModule(
  vscode: any,
  iframe: HTMLIFrameElement,
  statusBadge: HTMLElement,
  statusDot: HTMLElement,
  statusText: HTMLElement,
  saveBtn: HTMLButtonElement,
  autoSaveToggle: HTMLInputElement,
  baseUri: string | null,
  dirtyRuntimeIds: Set<string>
) {
  const DEBOUNCE_DELAY = 1000;

  const debouncedSave = debounce(() => {
    const { isDirty, autoSaveEnabled } = getState();
    if (isDirty && autoSaveEnabled) {
      save();
    }
  }, DEBOUNCE_DELAY);

  function setSaveStatus(status: SaveStatus) {
    updateState({ saveStatus: status });

    if (statusBadge && statusDot && statusText) {
      statusBadge.className = 'status-indicator status-' + status;
      if (status === 'saved') {
        statusText.textContent = 'Saved';
      } else if (status === 'unsaved') {
        statusText.textContent = 'Unsaved';
      } else if (status === 'saving') {
        statusText.textContent = 'Saving…';
      } else if (status === 'error') {
        statusText.textContent = 'Save failed';
      }
    }
  }

  function setDirtyState(dirty: boolean) {
    updateState({ isDirty: dirty });

    if (dirty) {
      setSaveStatus('unsaved');
      saveBtn.classList.add('dirty');
    } else {
      setSaveStatus('saved');
      saveBtn.classList.remove('dirty');
    }

    vscode.postMessage({
      command: 'setDirty',
      isDirty: dirty,
      html: dirty ? getCleanHTML() : null
    });
  }

  function toggleAutoSave(enabled?: boolean) {
    const { autoSaveEnabled, isDirty } = getState();
    const nextState = enabled !== undefined ? enabled : !autoSaveEnabled;
    updateState({ autoSaveEnabled: nextState });

    if (autoSaveToggle) {
      autoSaveToggle.checked = nextState;
    }

    if (!nextState) {
      debouncedSave.cancel();
    } else if (isDirty) {
      debouncedSave();
    }
  }

  function getCleanElementInnerHTML(elem: Element): string {
    const clone = elem.cloneNode(true) as Element;
    clone.removeAttribute('data-runtime-id');
    clone.classList.remove('vhe-editing-active');
    const runtimeElems = clone.querySelectorAll('[data-runtime-id]');
    for (let i = 0; i < runtimeElems.length; i++) {
      runtimeElems[i].removeAttribute('data-runtime-id');
    }
    const activeElems = clone.querySelectorAll('.vhe-editing-active');
    for (let i = 0; i < activeElems.length; i++) {
      activeElems[i].classList.remove('vhe-editing-active');
    }
    if ((clone as HTMLElement).style) (clone as HTMLElement).style.zoom = '';
    return clone.innerHTML;
  }

  function getCleanHTML(): string {
    const doc =
      iframe.contentDocument || (iframe.contentWindow ? iframe.contentWindow.document : null);
    if (!doc) return '';

    if (baseUri) {
      const injectedBase = doc.querySelector('base[href="' + baseUri + '"]');
      if (injectedBase) {
        injectedBase.remove();
      }
    }

    const originalZoom = doc.documentElement.style.zoom;
    doc.documentElement.style.zoom = '';

    const cloneDoc = doc.documentElement.cloneNode(true) as HTMLElement;
    cloneDoc.removeAttribute('data-runtime-id');
    cloneDoc.classList.remove('vhe-editing-active');

    const injectedStyle = cloneDoc.querySelector('#vhe-style-injection');
    if (injectedStyle) injectedStyle.remove();

    const runtimeElems = cloneDoc.querySelectorAll('[data-runtime-id]');
    for (let i = 0; i < runtimeElems.length; i++) {
      runtimeElems[i].removeAttribute('data-runtime-id');
    }
    const activeElems = cloneDoc.querySelectorAll('.vhe-editing-active');
    for (let i = 0; i < activeElems.length; i++) {
      activeElems[i].classList.remove('vhe-editing-active');
    }

    const currentHTML = '<!DOCTYPE html>\n' + cloneDoc.outerHTML;
    doc.documentElement.style.zoom = originalZoom;

    if (baseUri && doc.head && !doc.querySelector('base')) {
      const baseElem = doc.createElement('base');
      baseElem.href = baseUri;
      doc.head.insertBefore(baseElem, doc.head.firstChild);
    }

    return currentHTML;
  }

  function save() {
    try {
      debouncedSave.cancel();
      setSaveStatus('saving');

      const doc =
        iframe.contentDocument || (iframe.contentWindow ? iframe.contentWindow.document : null);
      const changes: Array<{ runtimeId: string; newInnerHTML: string }> = [];

      if (doc && dirtyRuntimeIds.size > 0) {
        for (const runtimeId of dirtyRuntimeIds) {
          const elem = doc.querySelector('[data-runtime-id="' + runtimeId + '"]');
          if (elem) {
            changes.push({
              runtimeId,
              newInnerHTML: getCleanElementInnerHTML(elem)
            });
          }
        }
      }

      const fallbackHTML = getCleanHTML();
      setDirtyState(false);
      dirtyRuntimeIds.clear();

      vscode.postMessage({
        command: 'saveSurgical',
        changes,
        fallbackHtml: fallbackHTML
      });
    } catch (err: any) {
      setSaveStatus('error');
      if (typeof (window as any).showError === 'function') {
        (window as any).showError('Error during Save operation: ' + err.message);
      }
    }
  }

  commandRegistry.register({
    id: 'save',
    group: 'document',
    icon: 'save',
    title: 'Save Document (Ctrl+S)',
    execute: save
  });

  commandRegistry.register({
    id: 'toggle-auto-save',
    group: 'settings',
    icon: 'zap',
    title: 'Toggle Auto Save',
    execute: (enabled?: boolean) => toggleAutoSave(enabled)
  });

  return { save, setDirtyState, toggleAutoSave, debouncedSave, getCleanHTML };
}
