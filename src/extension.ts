import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import { findChromeExecutable } from './utils/browserUtils';
import { SourceFileWatcher } from './utils/fileWatcher';
import { applySurgicalPatches, parseAndTagHtml } from './utils/htmlSurgicalMapper';
import {
  assertNever,
  type HostToWebviewMessage,
  type WebviewToHostMessage
} from './utils/ipcProtocol';
import { normalizePath } from './utils/pathUtils';
import { isPathContained } from './utils/securityUtils';
import { getWebviewContent } from './webview/editorContent';

const execFileAsync = promisify(execFile);

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
      const localResourceRoots: vscode.Uri[] = [fileFolder];
      if (vscode.workspace.workspaceFolders) {
        for (const folder of vscode.workspace.workspaceFolders) {
          localResourceRoots.push(folder.uri);
        }
      }

      const panel = vscode.window.createWebviewPanel(
        'visualHtmlEditor',
        `Visual: ${fileName}`,
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots
        }
      );

      let originalSourceHtml = document.getText();
      const { taggedHtml, offsetMap } = parseAndTagHtml(originalSourceHtml);
      let currentOffsetMap = offsetMap;

      const baseUri = `${panel.webview.asWebviewUri(fileFolder).toString()}/`;

      let isDirty = false;
      let lastUnsavedHTML: string | null = null;
      let isSaving = false;

      // Setup SourceFileWatcher to monitor target file & linked dependencies (CSS, JS, assets)
      const sourceWatcher = new SourceFileWatcher({
        targetUri: document.uri,
        htmlContent: originalSourceHtml,
        globPattern: '**/*.{html,css,js}',
        isSaving: () => isSaving,
        canRefresh: () => !isDirty,
        onRefresh: (changedUri?: any) => {
          if (!document) return;
          try {
            const newSourceHtml = document.getText();
            const isTargetDoc =
              !changedUri?.fsPath ||
              normalizePath(changedUri.fsPath) === normalizePath(document.uri.fsPath);

            if (isTargetDoc && newSourceHtml === originalSourceHtml) {
              return;
            }

            originalSourceHtml = newSourceHtml;
            sourceWatcher.updateHtmlContent(originalSourceHtml);
            const reParsed = parseAndTagHtml(originalSourceHtml);
            currentOffsetMap = reParsed.offsetMap;
            panel.webview.postMessage({
              command: 'forceReload',
              taggedHtml: reParsed.taggedHtml
            });
          } catch (err: unknown) {
            console.error(
              '[Visual HTML Editor SourceFileWatcher Refresh Error]',
              formatRawError(err)
            );
          }
        }
      });
      context.subscriptions.push(sourceWatcher);

      const autoSaveEnabled = context.globalState.get<boolean>(
        'visualHtmlEditor.autoSaveEnabled',
        false
      );
      panel.webview.html = getWebviewContent(taggedHtml, baseUri, autoSaveEnabled);

      const postToWebview = (msg: HostToWebviewMessage) => panel.webview.postMessage(msg);

      panel.webview.onDidReceiveMessage(
        async (message: WebviewToHostMessage) => {
          switch (message.command) {
            case 'toggleAutoSave': {
              if (typeof message.enabled === 'boolean') {
                await context.globalState.update(
                  'visualHtmlEditor.autoSaveEnabled',
                  message.enabled
                );
              }
              break;
            }
            case 'fetchLocalFile': {
              if (message.requestId && message.relativePath) {
                try {
                  const relPath = message.relativePath
                    .split('?')[0]
                    .split('#')[0]
                    .replace(/\\/g, '/');
                  const targetUri = vscode.Uri.joinPath(fileFolder, relPath);

                  // Security Path Traversal Guard: Restrict file reading to allowed workspace roots
                  const isAllowed = localResourceRoots.some((root) =>
                    isPathContained(root.fsPath, targetUri.fsPath)
                  );
                  if (!isAllowed) {
                    throw new Error('Security Error: Access denied to path outside workspace.');
                  }

                  const fileBytes = await vscode.workspace.fs.readFile(targetUri);
                  const content = new TextDecoder('utf-8').decode(fileBytes);
                  postToWebview({
                    command: 'fetchLocalFileResponse',
                    requestId: message.requestId,
                    success: true,
                    content
                  });
                } catch (err: any) {
                  const errorMsg = formatRawError(err) || `File not found: ${message.relativePath}`;
                  console.warn('[FetchLocalFile Error]', errorMsg);
                  postToWebview({
                    command: 'fetchLocalFileResponse',
                    requestId: message.requestId,
                    success: false,
                    error: errorMsg
                  });
                }
              }
              break;
            }
            case 'setDirty': {
              isDirty = !!message.isDirty;
              if (message.html) {
                lastUnsavedHTML = message.html;
              }
              break;
            }
            case 'reloadDocument': {
              if (!document) break;
              try {
                originalSourceHtml = document.getText();
                const reParsed = parseAndTagHtml(originalSourceHtml);
                currentOffsetMap = reParsed.offsetMap;
                postToWebview({
                  command: 'forceReload',
                  taggedHtml: reParsed.taggedHtml
                });
              } catch (err: unknown) {
                vscode.window.showErrorMessage(
                  `Failed to reload document from disk: ${formatRawError(err)}`
                );
              }
              break;
            }
            case 'exportPdf': {
              if (message.html) {
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

                  const exportWidth = message.width && message.width > 0 ? message.width : 1200;
                  const exportHeight = message.height && message.height > 0 ? message.height : 1600;

                  if (chromeBin) {
                    await fs.promises.writeFile(tempHtmlPath, message.html, 'utf8');
                    await execFileAsync(chromeBin, [
                      '--headless',
                      '--no-sandbox',
                      '--disable-gpu',
                      '--no-pdf-header-footer',
                      '--emulate-media-type=screen',
                      `--window-size=${exportWidth},${exportHeight}`,
                      `--print-to-pdf=${saveUri.fsPath}`,
                      tempHtmlPath
                    ]);

                    // Cleanup temp HTML
                    fs.promises.unlink(tempHtmlPath).catch((err) => {
                      console.warn('[Cleanup Temp HTML Warning]', err);
                    });

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
              }
              break;
            }
            case 'exportImage': {
              if (message.html) {
                try {
                  const defaultImgName = fileName.replace(/\.html$/i, '.png');
                  const saveUri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.joinPath(fileFolder, defaultImgName),
                    filters: {
                      'PNG Image': ['png'],
                      'JPEG Image': ['jpg', 'jpeg']
                    },
                    title: 'Export HTML to Image'
                  });

                  if (!saveUri) return;

                  const chromeBin = findChromeExecutable();
                  const tempDir = os.tmpdir();
                  const tempHtmlPath = path.join(tempDir, `export-${Date.now()}.html`);

                  const exportWidth = message.width && message.width > 0 ? message.width : 1200;
                  const exportHeight = message.height && message.height > 0 ? message.height : 1600;

                  if (chromeBin) {
                    await fs.promises.writeFile(tempHtmlPath, message.html, 'utf8');
                    await execFileAsync(chromeBin, [
                      '--headless',
                      '--no-sandbox',
                      '--disable-gpu',
                      '--hide-scrollbars',
                      '--force-device-scale-factor=2',
                      `--window-size=${exportWidth},${exportHeight}`,
                      `--screenshot=${saveUri.fsPath}`,
                      tempHtmlPath
                    ]);

                    fs.promises.unlink(tempHtmlPath).catch((err) => {
                      console.warn('[Cleanup Temp HTML Warning]', err);
                    });

                    const openAction = 'Open Image';
                    const choice = await vscode.window.showInformationMessage(
                      `✅ Exported Image: ${path.basename(saveUri.fsPath)}`,
                      openAction
                    );
                    if (choice === openAction) {
                      vscode.env.openExternal(saveUri);
                    }
                  } else {
                    vscode.window.showErrorMessage(
                      'Exporting to image requires Google Chrome or Chromium installed on your system.'
                    );
                  }
                } catch (err: any) {
                  vscode.window.showErrorMessage(`Failed to export image: ${err.message}`);
                }
              }
              break;
            }
            case 'save':
            case 'saveSurgical': {
              if (!document) break;

              if (isSaving) {
                console.warn(
                  '[Visual HTML Editor] Save command ignored: another save operation is currently in progress.'
                );
                postToWebview({
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

                const liveText = document.getText();
                const hasExternalConflict =
                  originalSourceHtml !== null &&
                  liveText !== originalSourceHtml &&
                  !message.forceOverwrite;

                if (hasExternalConflict) {
                  const choice = await vscode.window.showWarningMessage(
                    `File "${fileName}" was modified outside of this editor. Which version would you like to keep?`,
                    {
                      modal: true,
                      detail:
                        'Another program, Git, or editor modified this file on disk. You can keep your visual edits or load the file from disk.'
                    },
                    'Keep My Visual Edits',
                    'Load File From Disk'
                  );

                  if (choice === 'Load File From Disk') {
                    originalSourceHtml = liveText;
                    const reParsed = parseAndTagHtml(originalSourceHtml);
                    currentOffsetMap = reParsed.offsetMap;
                    postToWebview({
                      command: 'forceReload',
                      taggedHtml: reParsed.taggedHtml
                    });
                    postToWebview({
                      command: 'saveCompleted',
                      success: false,
                      error: 'Loaded latest version from disk.'
                    });
                    return;
                  } else if (choice !== 'Keep My Visual Edits') {
                    postToWebview({
                      command: 'saveCompleted',
                      success: false,
                      error: 'Save canceled.'
                    });
                    return;
                  }
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

                    postToWebview({
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
                postToWebview({
                  command: 'saveCompleted',
                  success: false,
                  error: rawErrorPayload
                });
              } finally {
                sourceWatcher.cancelPending();
                isSaving = false;
              }
              break;
            }
            default: {
              assertNever(message);
            }
          }
        },
        undefined,
        context.subscriptions
      );

      // Tab Disposal Guard
      panel.onDidDispose(async () => {
        sourceWatcher.dispose();
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
