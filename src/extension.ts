import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import { applySurgicalPatches, parseAndTagHtml } from './utils/htmlSurgicalMapper';
import { getWebviewContent } from './webview/editorContent';

const execFileAsync = promisify(execFile);

function findChromeExecutable(): string | null {
  const platform = os.platform();
  const candidates: string[] = [];

  if (platform === 'linux') {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser'
    );
  } else if (platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    );
  } else if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files';
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';

    candidates.push(
      path.join(programFiles, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(programFilesX86, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(localAppData, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(programFiles, 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(programFilesX86, 'Microsoft\\Edge\\Application\\msedge.exe')
    );
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function formatRawError(error: unknown): string {
  if (error === null || error === undefined) {
    return 'Unknown error (null or undefined)';
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    const name = error.name || 'Error';
    const msg = error.message || String(error);
    const stack = error.stack ? `\n[Raw Stack Trace]\n${error.stack}` : '';
    const cause = (error as any).cause
      ? `\n[Raw Cause]\n${formatRawError((error as any).cause)}`
      : '';
    return `[${name}] ${msg}${stack}${cause}`;
  }
  try {
    return `[Raw Error Object]\n${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`;
  } catch {
    return `[Raw Error String]\n${String(error)}`;
  }
}

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
      const defaultPdfName = fileName.replace(/\.html$/i, '.pdf');
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
      let isSaving = false;

      // Sync originalSourceHtml and offsetMap when document is edited externally
      const changeSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
        try {
          if (!isSaving && document && e.document.uri.toString() === document.uri.toString()) {
            originalSourceHtml = document.getText();
            const reParsed = parseAndTagHtml(originalSourceHtml);
            currentOffsetMap = reParsed.offsetMap;
          }
        } catch (err: unknown) {
          console.error(
            '[Visual HTML Editor onDidChangeTextDocument Raw Error]',
            formatRawError(err)
          );
        }
      });
      context.subscriptions.push(changeSubscription);

      const autoSaveEnabled = context.globalState.get<boolean>(
        'visualHtmlEditor.autoSaveEnabled',
        true
      );
      panel.webview.html = getWebviewContent(taggedHtml, baseUri, autoSaveEnabled);

      panel.webview.onDidReceiveMessage(
        async (message: {
          command: string;
          html?: string;
          isDirty?: boolean;
          enabled?: boolean;
          changes?: Array<{ runtimeId: string; newInnerHTML: string }>;
          fallbackHtml?: string;
        }) => {
          if (message.command === 'toggleAutoSave' && typeof message.enabled === 'boolean') {
            await context.globalState.update('visualHtmlEditor.autoSaveEnabled', message.enabled);
          } else if (message.command === 'setDirty') {
            isDirty = !!message.isDirty;
            if (message.html) {
              lastUnsavedHTML = message.html;
            }
          } else if (message.command === 'exportPdf' && message.html) {
            try {
              const saveUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.joinPath(fileFolder, defaultPdfName),
                filters: { 'PDF Document': ['pdf'] },
                title: 'Export HTML to PDF'
              });

              if (!saveUri) return;

              const chromeBin = findChromeExecutable();
              const tempDir = os.tmpdir();
              const tempHtmlPath = path.join(tempDir, `export-${Date.now()}.html`);

              if (chromeBin) {
                await fs.promises.writeFile(tempHtmlPath, message.html, 'utf8');
                await execFileAsync(chromeBin, [
                  '--headless',
                  '--no-sandbox',
                  '--disable-gpu',
                  `--print-to-pdf=${saveUri.fsPath}`,
                  tempHtmlPath
                ]);

                // Cleanup temp HTML
                fs.promises.unlink(tempHtmlPath).catch(() => {});

                const openAction = 'Open PDF';
                const choice = await vscode.window.showInformationMessage(
                  `✅ Exported PDF: ${path.basename(saveUri.fsPath)}`,
                  openAction
                );
                if (choice === openAction) {
                  vscode.env.openExternal(saveUri);
                }
              } else {
                // Fallback to browser window if no headless binary found
                const autoPrintScript =
                  '<script>window.onload = function() { setTimeout(function() { window.print(); }, 300); };</script>';
                const autoPrintHtml = message.html.includes('</head>')
                  ? message.html.replace('</head>', `${autoPrintScript}</head>`)
                  : `${message.html}${autoPrintScript}`;

                await fs.promises.writeFile(tempHtmlPath, autoPrintHtml, 'utf8');
                await vscode.env.openExternal(vscode.Uri.file(tempHtmlPath));
              }
            } catch (err: any) {
              vscode.window.showErrorMessage(`Failed to export PDF: ${err.message}`);
            }
          } else if (
            (message.command === 'save' || message.command === 'saveSurgical') &&
            document
          ) {
            if (isSaving) {
              console.warn(
                '[Visual HTML Editor] Save command ignored: another save operation is currently in progress.'
              );
              panel.webview.postMessage({
                command: 'saveCompleted',
                success: false,
                error: 'Save command ignored: another save operation is in progress.'
              });
              return;
            }
            isSaving = true;

            try {
              // Ensure document instance is live and open before editing
              if (document.isClosed) {
                document = await vscode.workspace.openTextDocument(document.uri);
              }

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
                }
              }

              if (finalHtml) {
                const currentText = document.getText();
                const fullRange = new vscode.Range(
                  document.positionAt(0),
                  document.positionAt(currentText.length)
                );
                const edit = new vscode.WorkspaceEdit();
                edit.replace(document.uri, fullRange, finalHtml);

                let success = await vscode.workspace.applyEdit(edit);
                if (!success) {
                  console.warn(
                    '[Visual HTML Editor] Initial workspace edit failed. Retrying after 50ms pause...'
                  );
                  // Retry once after 50ms if workspace edit failed due to doc state locking
                  await new Promise((resolve) => setTimeout(resolve, 50));
                  if (document.isClosed) {
                    document = await vscode.workspace.openTextDocument(document.uri);
                  }
                  const freshText = document.getText();
                  const retryRange = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(freshText.length)
                  );
                  const retryEdit = new vscode.WorkspaceEdit();
                  retryEdit.replace(document.uri, retryRange, finalHtml);
                  success = await vscode.workspace.applyEdit(retryEdit);
                }

                if (success) {
                  // Ensure document is live right before calling save()
                  if (document.isClosed) {
                    document = await vscode.workspace.openTextDocument(document.uri);
                  }
                  await document.save();
                  isDirty = false;
                  lastUnsavedHTML = null;

                  // Post-Save Re-synchronization: Formatter might have reformatted document.getText() on save!
                  originalSourceHtml = document.getText();
                  const reParsed = parseAndTagHtml(originalSourceHtml);
                  currentOffsetMap = reParsed.offsetMap;

                  panel.webview.postMessage({
                    command: 'saveCompleted',
                    success: true,
                    taggedHtml: reParsed.taggedHtml
                  });
                } else {
                  throw new Error(
                    `Failed to apply workspace edit to file "${fileName}". The text document may be locked or modified concurrently by another extension.`
                  );
                }
              } else {
                throw new Error('Save aborted: Generated HTML payload is empty.');
              }
            } catch (err: unknown) {
              const rawErrorPayload = formatRawError(err);
              console.error('[Visual HTML Editor Raw Extension Error]', rawErrorPayload);
              const displayMsg = err instanceof Error ? err.message : String(err);
              vscode.window.showErrorMessage(
                `[Visual HTML Editor Error] Save failed: ${displayMsg}`
              );
              panel.webview.postMessage({
                command: 'saveCompleted',
                success: false,
                error: rawErrorPayload
              });
            } finally {
              isSaving = false;
            }
          }
        },
        undefined,
        context.subscriptions
      );

      // Tab Disposal Guard
      panel.onDidDispose(async () => {
        if (isDirty && lastUnsavedHTML && document) {
          const choice = await vscode.window.showWarningMessage(
            `You closed Visual HTML Editor for "${fileName}" with unsaved changes. Would you like to save them now?`,
            'Save Now',
            'Discard'
          );

          if (choice === 'Save Now') {
            try {
              if (document.isClosed) {
                document = await vscode.workspace.openTextDocument(document.uri);
              }
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
      }, null);
    }
  );

  context.subscriptions.push(disposable);
}
