import { getPolyfillScriptString } from './polyfill';
import { getState } from './state';

export interface RenderDocumentOptions {
  doc: Document;
  htmlString: string;
  baseUri: string | null;
  dirtyRuntimeIds: Set<string>;
  saveModule: {
    setDirtyState: (dirty: boolean) => void;
    debouncedSave: () => void;
  };
  zoomModule: {
    applyZoom: () => void;
  };
  iframe: HTMLIFrameElement;
  onWheel: (e: WheelEvent) => void;
  onKeydown: (e: KeyboardEvent) => void;
}

const POLYFILL_JS = getPolyfillScriptString();

export function prepareDocumentHtml(htmlString: string, base: string | null): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    if (base && base !== 'null' && base !== 'undefined' && !doc.querySelector('base')) {
      const baseElem = doc.createElement('base');
      baseElem.href = base;
      if (doc.head) {
        doc.head.insertBefore(baseElem, doc.head.firstChild);
      }
    }

    if (doc.head && !doc.querySelector('#vhe-fetch-polyfill')) {
      const scriptElem = doc.createElement('script');
      scriptElem.id = 'vhe-fetch-polyfill';
      scriptElem.setAttribute('data-vhe-injected', 'fetch-polyfill');
      scriptElem.textContent = POLYFILL_JS;
      doc.head.insertBefore(scriptElem, doc.head.firstChild);
    }

    const doctypeMatch = htmlString.match(/^\s*(<!DOCTYPE[^>]*>)/i);
    const doctypePrefix = doctypeMatch ? `${doctypeMatch[1]}\n` : '';
    return doctypePrefix + doc.documentElement.outerHTML;
  } catch (e) {
    console.warn('[Visual HTML Editor] DOMParser notice:', e);
    return htmlString;
  }
}

export function resolveNestedIframes(doc: Document, fallbackBaseUri?: string | null): void {
  const iframes = doc.querySelectorAll('iframe[src]');
  iframes.forEach(async (ifrm) => {
    const iframeElem = ifrm as HTMLIFrameElement;
    const src = iframeElem.getAttribute('src');
    if (
      src &&
      !src.startsWith('http://') &&
      !src.startsWith('https://') &&
      !src.startsWith('data:')
    ) {
      try {
        const targetUrl = new URL(
          src,
          doc.baseURI ||
            (fallbackBaseUri && fallbackBaseUri !== 'null' ? fallbackBaseUri : window.location.href)
        ).href;
        const res = await fetch(targetUrl);
        if (res.ok) {
          const text = await res.text();
          iframeElem.removeAttribute('src');
          if (!iframeElem.hasAttribute('sandbox')) {
            iframeElem.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
          }
          iframeElem.srcdoc = text;
        }
      } catch (e) {
        console.warn('[Visual HTML Editor] Nested iframe fetch notice:', src, e);
      }
    }
  });
}

export function registerMutationTracker(
  doc: Document,
  dirtyRuntimeIds: Set<string>,
  saveModule: {
    setDirtyState: (dirty: boolean) => void;
    debouncedSave: () => void;
  }
): void {
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
  doc.addEventListener('beforeinput', (e) => markTargetDirty(e.target as Node));
  doc.addEventListener('change', (e) => markTargetDirty(e.target as Node));
  doc.addEventListener('paste', (e) => markTargetDirty((e.target as Node) || doc.activeElement));
  doc.addEventListener('cut', (e) => markTargetDirty((e.target as Node) || doc.activeElement));
  doc.addEventListener('drop', (e) => markTargetDirty((e.target as Node) || doc.activeElement));
  doc.addEventListener('keyup', (e) => {
    if (!e.ctrlKey && !e.metaKey && e.key !== 'Control' && e.key !== 'Shift') {
      markTargetDirty((e.target as Node) || doc.activeElement);
    }
  });
}

export function renderDocumentIntoIframe(options: RenderDocumentOptions): void {
  const {
    doc,
    htmlString,
    baseUri,
    dirtyRuntimeIds,
    saveModule,
    zoomModule,
    iframe,
    onWheel,
    onKeydown
  } = options;

  const preparedHtml = prepareDocumentHtml(htmlString, baseUri);
  doc.open();
  doc.write(preparedHtml);
  doc.close();

  resolveNestedIframes(doc, baseUri);

  if (baseUri && doc.head && !doc.querySelector('base')) {
    const baseElem = doc.createElement('base');
    baseElem.href = baseUri;
    doc.head.insertBefore(baseElem, doc.head.firstChild);
  }

  if (doc.head && !doc.querySelector('#vhe-style-injection')) {
    const styleElem = doc.createElement('style');
    styleElem.id = 'vhe-style-injection';
    styleElem.textContent = `
        .vhe-editing-active {
          outline: 1.5px solid rgba(59, 130, 246, 0.45) !important;
          outline-offset: 2px !important;
          border-radius: 2px !important;
          background-color: rgba(59, 130, 246, 0.03) !important;
        }
      `;
    doc.head.appendChild(styleElem);
  }

  doc.addEventListener('click', (e) => {
    if (getState().mode !== 'edit') return;
    const target = (e.target as HTMLElement).closest('*') as HTMLElement | null;
    const activeElems = doc.querySelectorAll('.vhe-editing-active');
    for (let i = 0; i < activeElems.length; i++) {
      activeElems[i].classList.remove('vhe-editing-active');
      if (activeElems[i].classList.length === 0 || !activeElems[i].getAttribute('class')) {
        activeElems[i].removeAttribute('class');
      }
    }
    if (target && target !== doc.body && target !== doc.documentElement) {
      target.classList.add('vhe-editing-active');
    }
  });

  if (iframe?.contentWindow) {
    iframe.contentWindow.onerror = (msg, url, line) => {
      console.warn('[Iframe Inner Notice]', msg, url, line);
      return false;
    };
  }

  doc.designMode = 'on';
  registerMutationTracker(doc, dirtyRuntimeIds, saveModule);
  doc.addEventListener('wheel', onWheel, { passive: false });
  doc.addEventListener('keydown', onKeydown);
  zoomModule.applyZoom();
}
