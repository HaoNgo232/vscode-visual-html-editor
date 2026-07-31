const vscode = require('vscode');
const { getWebviewContent } = require('./webview/editorContent');

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
    const fileFolder = vscode.Uri.joinPath(document.uri, '..');

    // Create Webview Panel
    const panel = vscode.window.createWebviewPanel(
      'visualHtmlEditor',
      `✏️ Visual: ${fileName}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [fileFolder]
      }
    );

    const initialContent = document.getText();
    const baseUri = panel.webview.asWebviewUri(fileFolder).toString() + '/';

    // Render Webview HTML
    panel.webview.html = getWebviewContent(initialContent, baseUri);

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

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
