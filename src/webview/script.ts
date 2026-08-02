import { commandRegistry } from './modules/commandRegistry';
import { renderDocumentIntoIframe } from './modules/documentRuntime';
import { initHistoryModule } from './modules/history';
import { initMenuModule } from './modules/menu';
import { initModeModule } from './modules/mode';
import { initSaveModule } from './modules/saveState';
import { getState } from './modules/state';
import { initViewportModule } from './modules/viewport';
import { initZoomModule } from './modules/zoom';

declare function acquireVsCodeApi(): any;

// Global VS Code API & Placeholders
const vscode = acquireVsCodeApi();
const rawHTML = '__RAW_HTML_PLACEHOLDER__';
const baseUri = '__BASE_URI_PLACEHOLDER__' as unknown as string | null;
const initialAutoSaveEnabled = '__AUTO_SAVE_ENABLED_PLACEHOLDER__' as unknown as boolean;

// DOM Elements
const iframe = document.getElementById('editor-frame') as HTMLIFrameElement;
const iframeWrapper = document.getElementById('iframe-wrapper') as HTMLElement;
const statusBadge = document.getElementById('status-badge') as HTMLElement;
const statusDot = document.getElementById('status-dot') as HTMLElement;
const statusText = document.getElementById('status-text') as HTMLElement;
const saveBtn = document.getElementById('btn-save') as HTMLButtonElement;
const autoSaveToggle = document.getElementById('auto-save-toggle') as HTMLInputElement;
const moreMenu = document.getElementById('more-menu') as HTMLElement;
const helpModal = document.getElementById('help-modal') as HTMLElement;
const errorOverlay = document.getElementById('error-overlay') as HTMLElement;
const errorDetails = document.getElementById('error-details') as HTMLElement;

const dirtyRuntimeIds = new Set<string>();
let lastError = '';

// Modules Initialization
initModeModule(iframe);
const historyModule = initHistoryModule(iframe);
initViewportModule(iframeWrapper);
const zoomModule = initZoomModule(iframe);
const saveModule = initSaveModule(
  vscode,
  iframe,
  statusBadge,
  statusDot,
  statusText,
  saveBtn,
  autoSaveToggle,
  baseUri,
  dirtyRuntimeIds,
  typeof initialAutoSaveEnabled === 'boolean' ? initialAutoSaveEnabled : false
);
initMenuModule(moreMenu, helpModal, vscode, saveModule.getCleanHTML);

// Delegated Command Dispatcher for [data-command]
document.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement).closest('[data-command]');
  if (target) {
    const commandId = target.getAttribute('data-command');
    const value = target.getAttribute('data-value');
    if (commandId) {
      if (commandId === 'toggle-auto-save') {
        e.preventDefault();
        saveModule.toggleAutoSave();
        return;
      }
      commandRegistry.execute(commandId, value !== null ? value : undefined);
    }
  }
});

// Event Handlers
function handleWheel(e: WheelEvent) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    zoomModule.zoomChange(delta);
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey) {
    const key = e.key.toLowerCase();
    if (e.key === '=' || e.key === '+' || e.code === 'NumpadAdd') {
      e.preventDefault();
      zoomModule.zoomChange(0.1);
    } else if (e.key === '-' || e.code === 'NumpadSubtract') {
      e.preventDefault();
      zoomModule.zoomChange(-0.1);
    } else if (key === 's') {
      e.preventDefault();
      saveModule.save();
    } else if (key === 'z') {
      if (e.shiftKey) {
        e.preventDefault();
        historyModule.redo();
      } else {
        e.preventDefault();
        historyModule.undo();
      }
    } else if (key === 'y') {
      e.preventDefault();
      historyModule.redo();
    } else if (key === 'a') {
      const doc =
        iframe.contentDocument || (iframe.contentWindow ? iframe.contentWindow.document : null);
      if (doc) {
        const activeElem = doc.querySelector('.vhe-editing-active') as HTMLElement | null;
        if (activeElem && activeElem !== doc.body && activeElem !== doc.documentElement) {
          e.preventDefault();
          const win = iframe.contentWindow || window;
          const selection = win.getSelection();
          if (selection) {
            const range = doc.createRange();
            range.selectNodeContents(activeElem);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      }
    }
  }
}

// Error Boundary & Helpers
(window as any).showError = (err: unknown) => {
  let rawText = '';
  if (typeof err === 'string') {
    rawText = err;
  } else if (err instanceof Error) {
    rawText = `[${err.name}] ${err.message}${err.stack ? `\nStack:\n${err.stack}` : ''}`;
  } else {
    try {
      rawText = JSON.stringify(err, Object.getOwnPropertyNames(err as object), 2);
    } catch {
      rawText = String(err);
    }
  }

  console.error('[Visual HTML Editor Raw Webview Error]', err);
  lastError = rawText;
  if (errorDetails && errorOverlay) {
    errorDetails.textContent = rawText;
    errorOverlay.style.display = 'flex';
  }
};

commandRegistry.register({
  id: 'dismiss-error',
  execute: () => {
    if (errorOverlay) errorOverlay.style.display = 'none';
  }
});

commandRegistry.register({
  id: 'copy-error',
  execute: () => {
    if (navigator.clipboard && lastError) {
      navigator.clipboard.writeText(lastError);
      alert('Copied error log to clipboard!');
    }
  }
});

// Global Error Handlers
window.onerror = (message, source, lineno, colno, error) => {
  if (error) {
    (window as any).showError(error);
  } else {
    (window as any).showError(
      `Webview Uncaught Exception: ${message} at ${source}:${lineno}:${colno}`
    );
  }
  return false;
};

window.onunhandledrejection = (event) => {
  (window as any).showError(
    event.reason || 'Unhandled Promise Rejection (Reason empty or undefined)'
  );
};

window.onbeforeunload = (e) => {
  if (getState().isDirty) {
    e.preventDefault();
    e.returnValue = 'You have unsaved changes. Are you sure you want to close?';
    return e.returnValue;
  }
};

window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;

  if (data.command === 'fetchLocalFile') {
    vscode.postMessage(data);
  } else if (data.command === 'fetchLocalFileResponse') {
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(data, '*');
    }
  }
});

function renderDocument(doc: Document, htmlString: string) {
  renderDocumentIntoIframe({
    doc,
    htmlString,
    baseUri,
    dirtyRuntimeIds,
    saveModule,
    zoomModule,
    iframe,
    onWheel: handleWheel,
    onKeydown: handleKeydown
  });
}

function init() {
  try {
    const doc =
      iframe.contentDocument || (iframe.contentWindow ? iframe.contentWindow.document : null);
    if (!doc) return;

    renderDocument(doc, rawHTML);
  } catch (err: any) {
    (window as any).showError(
      `Failed to parse & render HTML document: ${err.message}\n\nStack:\n${err.stack}`
    );
  }
}

(window as any).updateIframeContent = (newHtml: string) => {
  try {
    const doc =
      iframe.contentDocument || (iframe.contentWindow ? iframe.contentWindow.document : null);
    if (!doc) return;

    const scrollTop = doc.documentElement.scrollTop || doc.body.scrollTop;
    const scrollLeft = doc.documentElement.scrollLeft || doc.body.scrollLeft;

    renderDocument(doc, newHtml);

    doc.documentElement.scrollTop = doc.body.scrollTop = scrollTop;
    doc.documentElement.scrollLeft = doc.body.scrollLeft = scrollLeft;
  } catch (err: unknown) {
    console.warn('[Visual HTML Editor Iframe Update Notice]', err);
  }
};

window.addEventListener('wheel', handleWheel, { passive: false });
window.addEventListener('keydown', handleKeydown);

init();
