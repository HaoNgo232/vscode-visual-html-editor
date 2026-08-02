import { debounce } from '../../utils/debounceUtils';
import { commandRegistry } from './commandRegistry';
import { getState, type SaveStatus, updateState } from './state';

export function removeInjectedRuntimeNodes(root: ParentNode): void {
  const injectedNodes = root.querySelectorAll('[data-vhe-injected="fetch-polyfill"]');

  for (let i = 0; i < injectedNodes.length; i++) {
    injectedNodes[i].remove();
  }
}

export function initSaveModule(
  vscode: any,
  iframe: HTMLIFrameElement,
  statusBadge: HTMLElement,
  statusDot: HTMLElement,
  statusText: HTMLElement,
  saveBtn: HTMLButtonElement,
  autoSaveToggle: HTMLInputElement,
  baseUri: string | null,
  dirtyRuntimeIds: Set<string>,
  initialAutoSaveEnabled: boolean = false
) {
  const DEBOUNCE_DELAY = 1000;

  updateState({ autoSaveEnabled: initialAutoSaveEnabled });
  if (autoSaveToggle) {
    autoSaveToggle.checked = initialAutoSaveEnabled;
  }

  const debouncedSave = debounce(() => {
    const { isDirty, autoSaveEnabled } = getState();
    if (isDirty && autoSaveEnabled) {
      save();
    }
  }, DEBOUNCE_DELAY);

  function setSaveStatus(status: SaveStatus) {
    updateState({ saveStatus: status });

    if (statusBadge && statusDot && statusText) {
      statusBadge.className = `status-indicator status-${status}`;
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

    vscode.postMessage({
      command: 'toggleAutoSave',
      enabled: nextState
    });

    if (!nextState) {
      debouncedSave.cancel();
    } else if (isDirty) {
      debouncedSave();
    }
  }

  function sanitizeNode(node: Element) {
    node.removeAttribute('data-runtime-id');
    node.classList.remove('vhe-editing-active');
    if (node.classList.length === 0 || node.getAttribute('class') === '') {
      node.removeAttribute('class');
    }
    if (node.getAttribute('style') === '' || node.getAttribute('style')?.trim() === '') {
      node.removeAttribute('style');
    }

    const allElements = node.querySelectorAll('*');
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i];
      el.removeAttribute('data-runtime-id');
      el.classList.remove('vhe-editing-active');
      if (el.classList.length === 0 || el.getAttribute('class') === '') {
        el.removeAttribute('class');
      }
      if (el.getAttribute('style') === '' || el.getAttribute('style')?.trim() === '') {
        el.removeAttribute('style');
      }
    }
  }

  function getCleanElementInnerHTML(elem: Element): string {
    const clone = elem.cloneNode(true) as Element;
    sanitizeNode(clone);
    return clone.innerHTML;
  }

  function getCleanHTML(): string {
    const doc =
      iframe.contentDocument || (iframe.contentWindow ? iframe.contentWindow.document : null);
    if (!doc) return '';

    if (baseUri) {
      const injectedBase = doc.querySelector(`base[href="${baseUri}"]`);
      if (injectedBase) {
        injectedBase.remove();
      }
    }

    const originalZoom = doc.documentElement.style.zoom;
    doc.documentElement.style.zoom = '';

    const cloneDoc = doc.documentElement.cloneNode(true) as HTMLElement;
    const injectedStyle = cloneDoc.querySelector('#vhe-style-injection');
    if (injectedStyle) injectedStyle.remove();

    removeInjectedRuntimeNodes(cloneDoc);

    sanitizeNode(cloneDoc);

    const doctypeNode = doc.doctype;
    let doctypePrefix = '';
    if (doctypeNode) {
      doctypePrefix = `<!DOCTYPE ${doctypeNode.name}${
        doctypeNode.publicId ? ` PUBLIC "${doctypeNode.publicId}"` : ''
      }${doctypeNode.systemId ? ` "${doctypeNode.systemId}"` : ''}>\n`;
    }

    const currentHTML = `${doctypePrefix}${cloneDoc.outerHTML}`;
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
          const elem = doc.querySelector(`[data-runtime-id="${runtimeId}"]`);
          if (elem) {
            changes.push({
              runtimeId,
              newInnerHTML: getCleanElementInnerHTML(elem)
            });
          }
        }
      }

      const fallbackHTML = getCleanHTML();

      vscode.postMessage({
        command: 'saveSurgical',
        changes,
        fallbackHtml: fallbackHTML
      });
    } catch (err: any) {
      setSaveStatus('error');
      if (typeof (window as any).showError === 'function') {
        (window as any).showError(`Error during Save operation: ${err.message}`);
      }
    }
  }

  function reloadDocument() {
    if (getState().isDirty) {
      const confirmDiscard = confirm(
        'You have unsaved changes. Reloading will discard them and re-sync from disk. Continue?'
      );
      if (!confirmDiscard) return;
    }
    vscode.postMessage({ command: 'reloadDocument' });
  }

  window.addEventListener('message', (event) => {
    const message = event.data;
    if (message && message.command === 'saveCompleted') {
      if (message.success) {
        setDirtyState(false);
        dirtyRuntimeIds.clear();
        setSaveStatus('saved');
        if (message.taggedHtml && typeof (window as any).updateIframeContent === 'function') {
          (window as any).updateIframeContent(message.taggedHtml);
        }
      } else {
        setSaveStatus('error');
        if (typeof (window as any).showError === 'function') {
          (window as any).showError(`Save failed: ${message.error || 'Unknown error'}`);
        }
      }
    } else if (message && message.command === 'forceReload' && message.taggedHtml) {
      setDirtyState(false);
      dirtyRuntimeIds.clear();
      setSaveStatus('saved');
      if (typeof (window as any).updateIframeContent === 'function') {
        (window as any).updateIframeContent(message.taggedHtml);
      }
    }
  });

  commandRegistry.register({
    id: 'save',
    group: 'document',
    icon: 'save',
    title: 'Save Document (Ctrl+S)',
    execute: save
  });

  commandRegistry.register({
    id: 'reload-doc',
    group: 'document',
    icon: 'refresh',
    title: 'Reload Document from Disk',
    execute: reloadDocument
  });

  commandRegistry.register({
    id: 'toggle-auto-save',
    group: 'settings',
    icon: 'zap',
    title: 'Toggle Auto Save',
    execute: (enabled?: boolean) => toggleAutoSave(enabled)
  });

  return { save, setDirtyState, toggleAutoSave, reloadDocument, debouncedSave, getCleanHTML };
}
