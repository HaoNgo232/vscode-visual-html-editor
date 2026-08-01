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
    const programFiles = process.env['PROGRAMFILES'] || 'C:\\Program Files';
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
