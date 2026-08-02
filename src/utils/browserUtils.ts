import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
// ponytail: Browser detection checks setting, common OS paths (incl. Snap/Flatpak), and PATH binary lookup via which/where. Ceiling: Doesn't auto-download Chromium binary. Upgrade path: Add @puppeteer/browsers on-demand fetcher.
export function findChromeExecutable(customVscodeApi?: any): string | null {
  try {
    let vscodeApi = customVscodeApi;
    if (!vscodeApi) {
      try {
        vscodeApi = require('vscode');
      } catch {
        // vscode not available in standalone bun test runner
      }
    }
    const customPath = vscodeApi?.workspace
      ?.getConfiguration('visualHtmlEditor')
      ?.get('executablePath') as string | undefined;
    if (customPath && fs.existsSync(customPath)) {
      return customPath;
    }
  } catch {
    // Handle standalone unit test environments where vscode module is un-mocked
  }

  const platform = os.platform();
  const candidates: string[] = [];

  if (platform === 'linux') {
    const home = os.homedir();
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
      '/snap/bin/google-chrome',
      path.join(home, '.local/share/flatpak/exports/bin/org.chromium.Chromium'),
      '/var/lib/flatpak/exports/bin/org.chromium.Chromium'
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
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    );
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  try {
    const cmd =
      platform === 'win32'
        ? 'where chrome.exe msedge.exe brave.exe'
        : 'which google-chrome google-chrome-stable chromium chromium-browser chrome msedge brave';
    const output = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const firstMatch = output
      .split(/[\r\n]+/)
      .map((line) => line.trim())
      .find((line) => line.length > 0 && fs.existsSync(line));
    if (firstMatch) {
      return firstMatch;
    }
  } catch {
    // PATH lookup failed or binary not found
  }

  return null;
}
