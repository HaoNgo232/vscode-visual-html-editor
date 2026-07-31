import * as vscode from 'vscode';
import { getWebviewContent } from './webview/editorContent';

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('visual-html-editor.open', async (uri?: vscode.Uri) => {
    let document: vscode.TextDocument | undefined;

    if (uri && uri.fsPath) {
      document = await vscode.workspace.openTextDocument(uri);
    } else if (vscode.window.activeTextEditor) {
      document = vscode.window.activeTextEditor.document;
    }

    if (!document || !document.fileName.endsWith('.html')) {
      vscode.window.showErrorMessage('Please select a valid .html file to open in Visual Editor!');
      return;
    }

    const fileName = document.fileName.split('/').pop() || 'document.html';
    const fileFolder = vscode.Uri.joinPath(document.uri, '..');

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

    let isDirty = false;
    let lastUnsavedHTML: string | null = null;

    panel.webview.html = getWebviewContent(initialContent, baseUri);

    panel.webview.onDidReceiveMessage(
      async (message: { command: string; html?: string; isDirty?: boolean }) => {
        if (message.command === 'setDirty') {
          isDirty = !!message.isDirty;
          if (message.html) {
            lastUnsavedHTML = message.html;
          }
        } else if (message.command === 'save' && message.html && document) {
          try {
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
              document.positionAt(0),
              document.positionAt(document.getText().length)
            );
            edit.replace(document.uri, fullRange, message.html);
            await vscode.workspace.applyEdit(edit);
            await document.save();
            isDirty = false;
            lastUnsavedHTML = null;
            vscode.window.showInformationMessage(`✅ Successfully saved changes to ${fileName}`);
          } catch (err: any) {
            vscode.window.showErrorMessage(`Error saving file: ${err.message}`);
          }
        }
      },
      undefined,
      context.subscriptions
    );

    // Tab Disposal Guard: Prompt user if tab is closed with unsaved changes
    panel.onDidDispose(
      async () => {
        if (isDirty && lastUnsavedHTML && document) {
          const choice = await vscode.window.showWarningMessage(
            `You closed Visual HTML Editor for "${fileName}" with unsaved changes. Would you like to save them now?`,
            'Save Now',
            'Discard'
          );

          if (choice === 'Save Now') {
            try {
              const edit = new vscode.WorkspaceEdit();
              const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(document.getText().length)
              );
              edit.replace(document.uri, fullRange, lastUnsavedHTML);
              await vscode.workspace.applyEdit(edit);
              await document.save();
              vscode.window.showInformationMessage(`✅ Saved unsaved changes to ${fileName}`);
            } catch (err: any) {
              vscode.window.showErrorMessage(`Failed to save pending changes: ${err.message}`);
            }
          }
        }
      },
      null,
      context.subscriptions
    );
  });

  context.subscriptions.push(disposable);
}

export function deactivate(): void {}
