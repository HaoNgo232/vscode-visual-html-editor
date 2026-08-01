const vscode = acquireVsCodeApi();
const iframe = document.getElementById("editor-frame");
const zoomBadge = document.getElementById("zoom-badge");
const statusBadge = document.getElementById("status-badge");
const errorOverlay = document.getElementById("error-overlay");
const errorDetails = document.getElementById("error-details");

const rawHTML = "__RAW_HTML_PLACEHOLDER__";
const baseUri = "__BASE_URI_PLACEHOLDER__";

let currentZoom = 1.0;
let lastError = "";
let isDirty = false;
let autoSaveEnabled = true;
const DEBOUNCE_DELAY = 1000;
const dirtyRuntimeIds = new Set();

function createDebounce(fn, wait) {
  let timeoutId = null;
  const debounced = function (...args) {
    if (timeoutId !== null) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn.apply(this, args);
    }, wait);
  };
  debounced.cancel = function () {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
  debounced.isPending = function () {
    return timeoutId !== null;
  };
  return debounced;
}

const debouncedSave = createDebounce(() => {
  if (isDirty && autoSaveEnabled) {
    save();
  }
}, DEBOUNCE_DELAY);

function toggleAutoSave(enabled) {
  autoSaveEnabled = enabled;
  if (!autoSaveEnabled) {
    debouncedSave.cancel();
  } else if (isDirty) {
    debouncedSave();
  }
}

// Track Dirty / Unsaved state
function setDirtyState(dirty) {
  isDirty = dirty;
  if (statusBadge) {
    if (isDirty) {
      statusBadge.textContent = "🔴 Unsaved Changes";
      statusBadge.className = "status-badge status-dirty";
    } else {
      statusBadge.textContent = "✅ Saved";
      statusBadge.className = "status-badge status-saved";
    }
  }
  vscode.postMessage({
    command: "setDirty",
    isDirty: isDirty,
    html: isDirty ? getCleanHTML() : null,
  });
}

// Unsaved Warning on Tab/Window Unload
window.onbeforeunload = function (e) {
  if (isDirty) {
    e.preventDefault();
    e.returnValue = "You have unsaved changes. Are you sure you want to close?";
    return e.returnValue;
  }
};

// Global Webview Error Boundary
window.onerror = function (message, source, lineno, colno, error) {
  showError("Webview Error: " + message + " (" + source + ":" + lineno + ":" + colno + ")");
  return false;
};

window.onunhandledrejection = function (event) {
  showError(
    "Unhandled Promise Rejection: " +
      (event.reason ? event.reason.message || event.reason : "Unknown reason")
  );
};

function showError(msg) {
  console.error("[Visual HTML Editor Error]", msg);
  lastError = msg;
  if (errorDetails && errorOverlay) {
    errorDetails.textContent = msg;
    errorOverlay.style.display = "flex";
  }
}

function dismissError() {
  if (errorOverlay) {
    errorOverlay.style.display = "none";
  }
}

function copyErrorDetails() {
  if (navigator.clipboard && lastError) {
    navigator.clipboard.writeText(lastError);
    alert("Copied error log to clipboard!");
  }
}

function applyZoom() {
  try {
    currentZoom = Math.max(0.3, Math.min(3.0, Math.round(currentZoom * 100) / 100));

    const doc = iframe ? iframe.contentDocument || iframe.contentWindow.document : null;
    if (doc && doc.documentElement) {
      doc.documentElement.style.zoom = currentZoom;
    }
    if (zoomBadge) {
      zoomBadge.textContent = Math.round(currentZoom * 100) + "%";
    }
  } catch (err) {
    showError("Zoom Error: " + err.message);
  }
}

function zoomChange(delta) {
  currentZoom += delta;
  applyZoom();
}

function resetZoom() {
  currentZoom = 1.0;
  applyZoom();
}

function handleWheel(e) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    zoomChange(delta);
  }
}

function handleKeydown(e) {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === "=" || e.key === "+" || e.code === "NumpadAdd") {
      e.preventDefault();
      zoomChange(0.1);
    } else if (e.key === "-" || e.code === "NumpadSubtract") {
      e.preventDefault();
      zoomChange(-0.1);
    } else if (e.key === "0") {
      e.preventDefault();
      resetZoom();
    } else if (e.key.toLowerCase() === "s") {
      e.preventDefault();
      save();
    }
  }
}

function registerMutationTracker(doc) {
  const markTargetDirty = (target) => {
    if (!target) return;
    let curr = target.nodeType === 3 ? target.parentElement : target;
    while (curr && curr !== doc.body && curr !== doc.documentElement && !curr.getAttribute("data-runtime-id")) {
      curr = curr.parentElement;
    }
    if (curr && curr.getAttribute("data-runtime-id")) {
      dirtyRuntimeIds.add(curr.getAttribute("data-runtime-id"));
      if (!isDirty) setDirtyState(true);
      if (autoSaveEnabled) {
        debouncedSave();
      }
    } else {
      if (!isDirty) setDirtyState(true);
      if (autoSaveEnabled) {
        debouncedSave();
      }
    }
  };

  doc.addEventListener("input", (e) => markTargetDirty(e.target));
  doc.addEventListener("keyup", (e) => {
    if (!e.ctrlKey && !e.metaKey && e.key !== "Control" && e.key !== "Shift") {
      markTargetDirty(e.target || doc.activeElement);
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
      characterData: true,
    });
  }
}

function init() {
  try {
    const doc = iframe ? iframe.contentDocument || iframe.contentWindow.document : null;
    if (!doc) return;

    doc.open();
    doc.write(rawHTML);
    doc.close();

    if (baseUri && doc.head && !doc.querySelector("base")) {
      const baseElem = doc.createElement("base");
      baseElem.href = baseUri;
      doc.head.insertBefore(baseElem, doc.head.firstChild);
    }

    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.onerror = function (msg, url, line, col, err) {
        console.warn("[Iframe Inner Notice]", msg, url, line);
        return false;
      };
    }

    setTimeout(() => {
      try {
        doc.designMode = "on";
        registerMutationTracker(doc);
        doc.addEventListener("wheel", handleWheel, { passive: false });
        doc.addEventListener("keydown", handleKeydown);
        applyZoom();
      } catch (e) {
        showError("Design Mode Activation Error: " + e.message);
      }
    }, 100);
  } catch (err) {
    showError("Failed to parse & render HTML document: " + err.message + "\n\nStack:\n" + err.stack);
  }
}

window.addEventListener("wheel", handleWheel, { passive: false });
window.addEventListener("keydown", handleKeydown);

function getCleanElementInnerHTML(elem) {
  const clone = elem.cloneNode(true);
  clone.removeAttribute("data-runtime-id");
  const runtimeElems = clone.querySelectorAll("[data-runtime-id]");
  for (let i = 0; i < runtimeElems.length; i++) {
    runtimeElems[i].removeAttribute("data-runtime-id");
  }
  if (clone.style) clone.style.zoom = "";
  return clone.innerHTML;
}

function getCleanHTML() {
  const doc = iframe ? iframe.contentDocument || iframe.contentWindow.document : null;
  if (!doc) return "";

  const injectedBase = doc.querySelector('base[href="' + baseUri + '"]');
  if (injectedBase) {
    injectedBase.remove();
  }

  const originalZoom = doc.documentElement.style.zoom;
  doc.documentElement.style.zoom = "";

  const cloneDoc = doc.documentElement.cloneNode(true);
  cloneDoc.removeAttribute("data-runtime-id");
  const runtimeElems = cloneDoc.querySelectorAll("[data-runtime-id]");
  for (let i = 0; i < runtimeElems.length; i++) {
    runtimeElems[i].removeAttribute("data-runtime-id");
  }

  const currentHTML = "<!DOCTYPE html>\n" + cloneDoc.outerHTML;

  doc.documentElement.style.zoom = originalZoom;

  if (baseUri && doc.head && !doc.querySelector("base")) {
    const baseElem = doc.createElement("base");
    baseElem.href = baseUri;
    doc.head.insertBefore(baseElem, doc.head.firstChild);
  }

  return currentHTML;
}

function save() {
  try {
    debouncedSave.cancel();
    const doc = iframe ? iframe.contentDocument || iframe.contentWindow.document : null;

    const changes = [];
    if (doc && dirtyRuntimeIds.size > 0) {
      for (const runtimeId of dirtyRuntimeIds) {
        const elem = doc.querySelector('[data-runtime-id="' + runtimeId + '"]');
        if (elem) {
          changes.push({
            runtimeId: runtimeId,
            newInnerHTML: getCleanElementInnerHTML(elem),
          });
        }
      }
    }

    const fallbackHTML = getCleanHTML();
    setDirtyState(false);
    dirtyRuntimeIds.clear();

    vscode.postMessage({
      command: "saveSurgical",
      changes: changes,
      fallbackHtml: fallbackHTML,
    });
  } catch (err) {
    showError("Error during Save operation: " + err.message);
  }
}

init();
