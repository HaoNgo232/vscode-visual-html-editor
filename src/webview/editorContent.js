/**
 * Generates the Webview HTML content for the Visual HTML Editor.
 * Includes a robust Error Boundary & Diagnostics overlay for UI debugging.
 */

function getWebviewContent(htmlContent, baseUri = null) {
  // Safely escape HTML/script tags so embedded HTML won't break the webview script tag
  const safeContent = JSON.stringify(htmlContent)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  const safeBaseUri = baseUri ? JSON.stringify(baseUri) : 'null';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: #1e1e2e;
      color: #cdd6f4;
      overflow: hidden;
    }
    .toolbar {
      background: #2b2b3b;
      border-bottom: 1px solid #45475a;
      padding: 8px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      user-select: none;
      z-index: 100;
    }
    .left-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .right-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn {
      background: #89b4fa;
      color: #11111b;
      border: none;
      padding: 6px 14px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      font-size: 13px;
      transition: background 0.2s;
    }
    .btn:hover { background: #b4befe; }
    
    .zoom-controls {
      display: flex;
      align-items: center;
      background: #181825;
      border: 1px solid #45475a;
      border-radius: 6px;
      padding: 2px 6px;
      gap: 4px;
    }
    .zoom-btn {
      background: transparent;
      color: #cdd6f4;
      border: none;
      width: 26px;
      height: 26px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .zoom-btn:hover {
      background: #313244;
      color: #89b4fa;
    }
    .zoom-badge {
      font-size: 12px;
      font-weight: 600;
      color: #a6adc8;
      min-width: 44px;
      text-align: center;
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 4px;
    }
    .zoom-badge:hover {
      color: #89b4fa;
      background: #313244;
    }

    .editor-container {
      flex: 1;
      background: #ffffff;
      overflow: auto;
      position: relative;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: #ffffff;
      display: block;
    }
    .hint {
      font-size: 13px;
      color: #a6adc8;
    }

    /* Error Overlay */
    .error-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(24, 24, 37, 0.95);
      color: #f38ba8;
      padding: 24px;
      display: none;
      flex-direction: column;
      gap: 16px;
      z-index: 200;
      overflow: auto;
      font-family: monospace;
    }
    .error-title {
      font-size: 18px;
      font-weight: bold;
      color: #f38ba8;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .error-box {
      background: #11111b;
      border: 1px solid #f38ba8;
      border-radius: 8px;
      padding: 16px;
      font-size: 13px;
      white-space: pre-wrap;
      word-break: break-all;
      color: #cdd6f4;
    }
    .error-actions {
      display: flex;
      gap: 12px;
    }
    .btn-danger {
      background: #f38ba8;
      color: #11111b;
    }
    .btn-secondary {
      background: #313244;
      color: #cdd6f4;
      border: 1px solid #45475a;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="left-group">
      <span class="hint">✏️ Click text to edit | <b>Ctrl + S</b> Save | <b>Ctrl + Scroll</b> / <b>Ctrl + +/-</b> Zoom</span>
    </div>
    <div class="right-group">
      <div class="zoom-controls">
        <button class="zoom-btn" onclick="zoomChange(-0.1)" title="Zoom Out (Ctrl + -)">-</button>
        <span class="zoom-badge" id="zoom-badge" onclick="resetZoom()" title="Click to reset zoom to 100%">100%</span>
        <button class="zoom-btn" onclick="zoomChange(0.1)" title="Zoom In (Ctrl + +)">+</button>
      </div>
      <button class="btn" onclick="save()">💾 Save Now (Ctrl+S)</button>
    </div>
  </div>

  <div class="editor-container" id="editor-container">
    <iframe id="editor-frame"></iframe>

    <!-- Diagnostics & Error Overlay -->
    <div class="error-overlay" id="error-overlay">
      <div class="error-title">⚠️ Visual HTML Editor Error Encountered</div>
      <div class="error-box" id="error-details">Unknown error occurred.</div>
      <div class="error-actions">
        <button class="btn btn-secondary" onclick="dismissError()">Dismiss Overlay</button>
        <button class="btn btn-secondary" onclick="copyErrorDetails()">📋 Copy Error Log</button>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const iframe = document.getElementById('editor-frame');
    const zoomBadge = document.getElementById('zoom-badge');
    const errorOverlay = document.getElementById('error-overlay');
    const errorDetails = document.getElementById('error-details');

    const rawHTML = ${safeContent};
    const baseUri = ${safeBaseUri};

    let currentZoom = 1.0;
    let lastError = '';

    // Global Webview Error Boundary
    window.onerror = function(message, source, lineno, colno, error) {
      showError('Webview Error: ' + message + ' (' + source + ':' + lineno + ':' + colno + ')');
      return false;
    };

    window.onunhandledrejection = function(event) {
      showError('Unhandled Promise Rejection: ' + (event.reason ? event.reason.message || event.reason : 'Unknown reason'));
    };

    function showError(msg) {
      console.error('[Visual HTML Editor Error]', msg);
      lastError = msg;
      if (errorDetails && errorOverlay) {
        errorDetails.textContent = msg;
        errorOverlay.style.display = 'flex';
      }
    }

    function dismissError() {
      if (errorOverlay) {
        errorOverlay.style.display = 'none';
      }
    }

    function copyErrorDetails() {
      if (navigator.clipboard && lastError) {
        navigator.clipboard.writeText(lastError);
        alert('Copied error log to clipboard!');
      }
    }

    function applyZoom() {
      try {
        currentZoom = Math.max(0.3, Math.min(3.0, Math.round(currentZoom * 100) / 100));
        
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        if (doc && doc.documentElement) {
          doc.documentElement.style.zoom = currentZoom;
        }
        if (zoomBadge) {
          zoomBadge.textContent = Math.round(currentZoom * 100) + '%';
        }
      } catch (err) {
        showError('Zoom Error: ' + err.message);
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
        if (e.key === '=' || e.key === '+' || e.code === 'NumpadAdd') {
          e.preventDefault();
          zoomChange(0.1);
        } else if (e.key === '-' || e.code === 'NumpadSubtract') {
          e.preventDefault();
          zoomChange(-0.1);
        } else if (e.key === '0') {
          e.preventDefault();
          resetZoom();
        } else if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          save();
        }
      }
    }

    function init() {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        
        // Catch iframe document write errors
        doc.open();
        doc.write(rawHTML);
        doc.close();

        // Inject baseUri if provided for relative asset resolution
        if (baseUri && doc.head && !doc.querySelector('base')) {
          const baseElem = doc.createElement('base');
          baseElem.href = baseUri;
          doc.head.insertBefore(baseElem, doc.head.firstChild);
        }

        // Add error boundary inside iframe window
        if (iframe.contentWindow) {
          iframe.contentWindow.onerror = function(msg, url, line, col, err) {
            console.warn('[Iframe Inner Notice]', msg, url, line);
            return false;
          };
        }

        setTimeout(() => {
          try {
            doc.designMode = 'on';
            doc.addEventListener('wheel', handleWheel, { passive: false });
            doc.addEventListener('keydown', handleKeydown);
            applyZoom();
          } catch (e) {
            showError('Design Mode Activation Error: ' + e.message);
          }
        }, 100);

      } catch (err) {
        showError('Failed to parse & render HTML document: ' + err.message + '\\n\\nStack:\\n' + err.stack);
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeydown);

    function save() {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        
        // Strip injected base tag if we added it dynamically
        const injectedBase = doc.querySelector('base[href="' + baseUri + '"]');
        if (injectedBase) {
          injectedBase.remove();
        }

        const originalZoom = doc.documentElement.style.zoom;
        doc.documentElement.style.zoom = '';

        const currentHTML = '<!DOCTYPE html>\\n' + doc.documentElement.outerHTML;
        
        doc.documentElement.style.zoom = originalZoom;

        // Re-inject baseUri after save so preview stays functional
        if (baseUri && doc.head && !doc.querySelector('base')) {
          const baseElem = doc.createElement('base');
          baseElem.href = baseUri;
          doc.head.insertBefore(baseElem, doc.head.firstChild);
        }

        vscode.postMessage({
          command: 'save',
          html: currentHTML
        });
      } catch (err) {
        showError('Error during Save operation: ' + err.message);
      }
    }

    init();
  </script>
</body>
</html>`;
}

module.exports = {
  getWebviewContent
};
