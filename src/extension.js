const vscode = require('vscode');

function activate(context) {
  let disposable = vscode.commands.registerCommand('visual-html-editor.open', async (uri) => {
    // Determine target document
    let document;
    if (uri && uri.fsPath) {
      document = await vscode.workspace.openTextDocument(uri);
    } else if (vscode.window.activeTextEditor) {
      document = vscode.window.activeTextEditor.document;
    }

    if (!document || !document.fileName.endsWith('.html')) {
      vscode.window.showErrorMessage('Please select a valid .html file to open in Visual Editor!');
      return;
    }

    const fileName = document.fileName.split('/').pop();

    // Create Webview Panel
    const panel = vscode.window.createWebviewPanel(
      'visualHtmlEditor',
      `✏️ Visual: ${fileName}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    const initialContent = document.getText();

    // Render Webview HTML
    panel.webview.html = getWebviewContent(initialContent);

    // Handle messages from Webview
    panel.webview.onDidReceiveMessage(
      async (message) => {
        if (message.command === 'save') {
          try {
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
              document.positionAt(0),
              document.positionAt(document.getText().length)
            );
            edit.replace(document.uri, fullRange, message.html);
            await vscode.workspace.applyEdit(edit);
            await document.save();
            vscode.window.showInformationMessage(`✅ Successfully saved changes to ${fileName}`);
          } catch (err) {
            vscode.window.showErrorMessage(`Error saving file: ${err.message}`);
          }
        }
      },
      undefined,
      context.subscriptions
    );
  });

  context.subscriptions.push(disposable);
}

function getWebviewContent(htmlContent) {
  const safeContent = JSON.stringify(htmlContent);

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
      width: 24px;
      height: 24px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .zoom-btn:hover {
      background: #313244;
    }
    .zoom-badge {
      font-size: 12px;
      font-weight: 500;
      color: #a6adc8;
      min-width: 42px;
      text-align: center;
      cursor: pointer;
    }
    .zoom-badge:hover {
      color: #89b4fa;
    }

    .editor-container {
      flex: 1;
      background: #ffffff;
      overflow: auto;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: #ffffff;
    }
    .hint {
      font-size: 13px;
      color: #a6adc8;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="left-group">
      <span class="hint">✏️ Click text to edit ➔ <b>Ctrl + S</b> to save | <b>Ctrl + Scroll</b> to zoom</span>
    </div>
    <div class="right-group">
      <div class="zoom-controls">
        <button class="zoom-btn" onclick="zoomChange(-0.1)" title="Zoom Out (Ctrl + Scroll Down)">-</button>
        <span class="zoom-badge" id="zoom-badge" onclick="resetZoom()" title="Click to reset zoom to 100%">100%</span>
        <button class="zoom-btn" onclick="zoomChange(0.1)" title="Zoom In (Ctrl + Scroll Up)">+</button>
      </div>
      <button class="btn" onclick="save()">💾 Save Now (Ctrl+S)</button>
    </div>
  </div>

  <div class="editor-container">
    <iframe id="editor-frame"></iframe>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const iframe = document.getElementById('editor-frame');
    const zoomBadge = document.getElementById('zoom-badge');
    const rawHTML = ${safeContent};

    let currentZoom = 1.0;

    function applyZoom() {
      currentZoom = Math.max(0.3, Math.min(3.0, Math.round(currentZoom * 100) / 100));
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      if (doc && doc.body) {
        doc.body.style.zoom = currentZoom;
      }
      zoomBadge.textContent = \`\${Math.round(currentZoom * 100)}%\`;
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
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.08 : -0.08;
        zoomChange(delta);
      }
    }

    function init() {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open();
      doc.write(rawHTML);
      doc.close();

      setTimeout(() => {
        doc.designMode = 'on';

        // Keyboard & Mouse Listeners inside iframe
        doc.addEventListener('keydown', (e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            save();
          }
        });

        doc.addEventListener('wheel', handleWheel, { passive: false });
      }, 100);
    }

    // Outer window listeners
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    });

    function save() {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const currentHTML = '<!DOCTYPE html>\\n' + doc.documentElement.outerHTML;
      vscode.postMessage({
        command: 'save',
        html: currentHTML
      });
    }

    init();
  </script>
</body>
</html>`;
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
