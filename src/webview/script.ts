import { commandRegistry } from './modules/commandRegistry';
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
const baseUri = '__BASE_URI_PLACEHOLDER__';

// DOM Elements
const iframe = document.getElementById('editor-frame') as HTMLIFrameElement;
const iframeWrapper = document.getElementById('iframe-wrapper') as HTMLElement;
const statusBadge = document.getElementById('status-badge') as HTMLElement;
const statusDot = document.getElementById('status-dot') as HTMLElement;
const statusText = document.getElementById('status-text') as HTMLElement;
const saveBtn = document.getElementById('btn-save') as HTMLButtonElement;
const autoSaveToggle = document.getElementById('auto-save-toggle') as HTMLInputElement;
const moreBtn = document.getElementById('btn-more') as HTMLElement;
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
  dirtyRuntimeIds
);
const menuModule = initMenuModule(moreMenu, helpModal);

// Delegated Command Dispatcher for [data-command]
document.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement).closest('[data-command]');
  if (target) {
    const commandId = target.getAttribute('data-command');
    const value = target.getAttribute('data-value');
    if (commandId) {
      // Prevent checkbox default handler from double firing toggle-auto-save
      if (commandId === 'toggle-auto-save' && (e.target as HTMLElement).tagName === 'INPUT') {
        saveModule.toggleAutoSave((e.target as HTMLInputElement).checked);
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
    } else if (e.key === '0') {
      e.preventDefault();
      zoomModule.resetZoom();
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
    }
  }
}

function registerMutationTracker(doc: Document) {
  const markTargetDirty = (target: Node | null) => {
    if (!target) return;
    let curr =
      target.nodeType === 3
        ? (target.parentElement as HTMLElement | null)
        : (target as HTMLElement);
    while (
      curr &&
      curr !== doc.body &&
      curr !== doc.documentElement &&
      !curr.getAttribute('data-runtime-id')
    ) {
      curr = curr.parentElement;
    }
    const runtimeId = curr?.getAttribute('data-runtime-id');
    if (runtimeId) {
      dirtyRuntimeIds.add(runtimeId);
      if (!getState().isDirty) saveModule.setDirtyState(true);
      if (getState().autoSaveEnabled) {
        saveModule.debouncedSave();
      }
    } else {
      if (!getState().isDirty) saveModule.setDirtyState(true);
      if (getState().autoSaveEnabled) {
        saveModule.debouncedSave();
      }
    }
  };

  doc.addEventListener('input', (e) => markTargetDirty(e.target as Node));
  doc.addEventListener('keyup', (e) => {
    if (!e.ctrlKey && !e.metaKey && e.key !== 'Control' && e.key !== 'Shift') {
      markTargetDirty((e.target as Node) || doc.activeElement);
    }
  });

  if (window.MutationObserver) {
    const observer = new MutationObserver((mutations) => {
      for (let i = 0; i < mutations.length; i++) {
        markTargetDirty(mutations[i].target);
      }
    });
    observer.observe(doc.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }
}

// Error Boundary & Helpers attached to window for test/global compatibility
(window as any).showError = (msg: string) => {
  console.error('[Visual HTML Editor Error]', msg);
  lastError = msg;
  if (errorDetails && errorOverlay) {
    errorDetails.textContent = msg;
    errorOverlay.style.display = 'flex';
  }
};

(window as any).dismissError = () => {
  if (errorOverlay) {
    errorOverlay.style.display = 'none';
  }
};

(window as any).copyErrorDetails = () => {
  if (navigator.clipboard && lastError) {
    navigator.clipboard.writeText(lastError);
    alert('Copied error log to clipboard!');
  }
};

(window as any).closeHelpModal = () => {
  menuModule.showHelpModal(false);
};

// Global Error Handlers
window.onerror = (message, source, lineno, colno, error) => {
  (window as any).showError(
    'Webview Error: ' + message + ' (' + source + ':' + lineno + ':' + colno + ')'
  );
  return false;
};

window.onunhandledrejection = (event) => {
  (window as any).showError(
    'Unhandled Promise Rejection: ' +
      (event.reason ? event.reason.message || event.reason : 'Unknown reason')
  );
};

window.onbeforeunload = (e) => {
  if (getState().isDirty) {
    e.preventDefault();
    e.returnValue = 'You have unsaved changes. Are you sure you want to close?';
    return e.returnValue;
  }
};

function init() {
  try {
    const doc =
      iframe.contentDocument || (iframe.contentWindow ? iframe.contentWindow.document : null);
    if (!doc) return;

    doc.open();
    doc.write(rawHTML);
    doc.close();

    if (baseUri && doc.head && !doc.querySelector('base')) {
      const baseElem = doc.createElement('base');
      baseElem.href = baseUri;
      doc.head.insertBefore(baseElem, doc.head.firstChild);
    }

    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.onerror = (msg, url, line) => {
        console.warn('[Iframe Inner Notice]', msg, url, line);
        return false;
      };
    }

    setTimeout(() => {
      try {
        doc.designMode = 'on';
        registerMutationTracker(doc);
        doc.addEventListener('wheel', handleWheel, { passive: false });
        doc.addEventListener('keydown', handleKeydown);
        zoomModule.applyZoom();
      } catch (e: any) {
        (window as any).showError('Design Mode Activation Error: ' + e.message);
      }
    }, 100);
  } catch (err: any) {
    (window as any).showError(
      'Failed to parse & render HTML document: ' + err.message + '\n\nStack:\n' + err.stack
    );
  }
}

window.addEventListener('wheel', handleWheel, { passive: false });
window.addEventListener('keydown', handleKeydown);

// Legacy export functions for backward compatibility in global scope
(window as any).save = saveModule.save;
(window as any).toggleAutoSave = saveModule.toggleAutoSave;
(window as any).zoomChange = zoomModule.zoomChange;
(window as any).resetZoom = zoomModule.resetZoom;
(window as any).setDirtyState = saveModule.setDirtyState;
(window as any).getCleanHTML = saveModule.getCleanHTML;

init();
