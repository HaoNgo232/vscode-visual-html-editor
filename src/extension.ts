import * as vscode from 'vscode';
import { applySurgicalPatches, parseAndTagHtml } from './utils/htmlSurgicalMapper';
import { getWebviewContent } from './webview/editorContent';

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand(
    'visual-html-editor.open',
    async (uri?: vscode.Uri) => {
      let document: vscode.TextDocument | undefined;

      if (uri?.fsPath) {
        document = await vscode.workspace.openTextDocument(uri);
      } else if (vscode.window.activeTextEditor) {
        document = vscode.window.activeTextEditor.document;
      }

      if (!document?.fileName.endsWith('.html')) {
        vscode.window.showErrorMessage(
          'Please select a valid .html file to open in Visual Editor!'
        );
        return;
      }

      const fileName = document.fileName.split('/').pop() || 'document.html';
      const fileFolder = vscode.Uri.joinPath(document.uri, '..');

      const panel = vscode.window.createWebviewPanel(
        'visualHtmlEditor',
        `Visual: ${fileName}`,
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [fileFolder]
        }
      );

      let originalSourceHtml = document.getText();
      const { taggedHtml, offsetMap } = parseAndTagHtml(originalSourceHtml);
      let currentOffsetMap = offsetMap;

      const baseUri = `${panel.webview.asWebviewUri(fileFolder).toString()}/`;

      let isDirty = false;
      let lastUnsavedHTML: string | null = null;

      panel.webview.html = getWebviewContent(taggedHtml, baseUri);

      panel.webview.onDidReceiveMessage(
        async (message: {
          command: string;
          html?: string;
          isDirty?: boolean;
          changes?: Array<{ runtimeId: string; newInnerHTML: string }>;
          fallbackHtml?: string;
        }) => {
          if (message.command === 'setDirty') {
            isDirty = !!message.isDirty;
            if (message.html) {
              lastUnsavedHTML = message.html;
            }
          } else if (
            (message.command === 'save' || message.command === 'saveSurgical') &&
            document
          ) {
            try {
              let finalHtml = message.fallbackHtml || message.html || '';

              if (
                message.command === 'saveSurgical' &&
                message.changes &&
                message.changes.length > 0 &&
                currentOffsetMap &&
                originalSourceHtml
              ) {
                const patched = applySurgicalPatches(
                  originalSourceHtml,
                  currentOffsetMap,
                  message.changes
                );
                if (patched && patched !== originalSourceHtml) {
                  finalHtml = patched;
                  originalSourceHtml = patched;
                  const reParsed = parseAndTagHtml(patched);
                  currentOffsetMap = reParsed.offsetMap;
                }
              }

              if (finalHtml) {
                const edit = new vscode.WorkspaceEdit();
                const fullRange = new vscode.Range(
                  document.positionAt(0),
                  document.positionAt(document.getText().length)
                );
                edit.replace(document.uri, fullRange, finalHtml);
                await vscode.workspace.applyEdit(edit);
                await document.save();
                isDirty = false;
                lastUnsavedHTML = null;
              }
            } catch (err: any) {
              vscode.window.showErrorMessage(`Error saving file: ${err.message}`);
            }
          }
        },
        undefined,
        context.subscriptions
      );

      // Tab Disposal Guard
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
                vscode.window.showInformationMessage(`✅ Saved ${fileName}`);
              } catch (err: any) {
                vscode.window.showErrorMessage(`Failed to save pending changes: ${err.message}`);
              }
            }
          }
        },
        null,
        context.subscriptions
      );
    }
  );

  context.subscriptions.push(disposable);
}
