import { describe, expect, it } from 'bun:test';
import {
  extractRelatedFilePaths,
  isUriRelated,
  resolvePathDeterministic,
  SourceFileWatcher,
  type UriLike
} from '../src/utils/fileWatcher';

describe('SourceFileWatcher Unit Test Suite (Bun)', () => {
  it('should extract relative file paths (href, src, data, @import) from HTML content', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <link rel="stylesheet" href="./styles/main.css?v=1.2#top">
          <script src="../js/app.js"></script>
          <style>
            @import url('../../css/theme.css');
            @import 'shared/global.css';
          </style>
        </head>
        <body>
          <img src="images/my%20logo.png">
          <iframe src="http://external.com/page"></iframe>
          <iframe src="components/card.html"></iframe>
        </body>
      </html>
    `;

    const extracted = extractRelatedFilePaths(html);
    expect(extracted).toContain('./styles/main.css');
    expect(extracted).toContain('../js/app.js');
    expect(extracted).toContain('../../css/theme.css');
    expect(extracted).toContain('shared/global.css');
    expect(extracted).toContain('images/my logo.png');
    expect(extracted).toContain('components/card.html');
    expect(extracted).not.toContain('http://external.com/page');
  });

  it('should accurately resolve complex parent directory traversal paths (../)', () => {
    const baseDir = '/home/user/project/src/pages';
    const rel1 = '../../styles/theme.css';
    const resolved = resolvePathDeterministic(baseDir, rel1);

    expect(resolved).toBe('/home/user/project/styles/theme.css');
  });

  it('should accurately determine if a changed URI is related to target document or complex dependencies', () => {
    const targetUri: UriLike = {
      fsPath: '/home/project/src/pages/index.html',
      toString: () => 'file:///home/project/src/pages/index.html'
    };

    const relatedPaths = ['../../styles/theme.css', 'js/app.js'];

    // Direct match
    expect(isUriRelated(targetUri, targetUri, relatedPaths)).toBe(true);

    // Same directory file
    const sameDirFile: UriLike = {
      fsPath: '/home/project/src/pages/about.html',
      toString: () => 'file:///home/project/src/pages/about.html'
    };
    expect(isUriRelated(sameDirFile, targetUri, relatedPaths)).toBe(true);

    // Complex parent traversal dependency match (../../styles/theme.css -> /home/project/styles/theme.css)
    const parentTraversalDepFile: UriLike = {
      fsPath: '/home/project/styles/theme.css',
      toString: () => 'file:///home/project/styles/theme.css'
    };
    expect(isUriRelated(parentTraversalDepFile, targetUri, relatedPaths)).toBe(true);

    // Unrelated file outside directory/dependencies
    const unrelatedFile: UriLike = {
      fsPath: '/home/project/backend/server.py',
      toString: () => 'file:///home/project/backend/server.py'
    };
    expect(isUriRelated(unrelatedFile, targetUri, relatedPaths)).toBe(false);
  });

  it('should trigger debounced onRefresh when changes occur', async () => {
    let refreshCalls = 0;
    let lastUri: UriLike | undefined;

    const watcher = new SourceFileWatcher({
      debounceMs: 40,
      onRefresh: (uri) => {
        refreshCalls++;
        lastUri = uri;
      }
    });

    const testUri: UriLike = {
      fsPath: '/test/index.html',
      toString: () => 'file:///test/index.html'
    };
    watcher.triggerRefresh(testUri);

    expect(refreshCalls).toBe(0);

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(refreshCalls).toBe(1);
    expect(lastUri?.fsPath).toBe('/test/index.html');

    watcher.dispose();
  });

  it('should debounce rapid consecutive file change events', async () => {
    let refreshCalls = 0;

    const watcher = new SourceFileWatcher({
      debounceMs: 50,
      onRefresh: () => {
        refreshCalls++;
      }
    });

    watcher.triggerRefresh();
    await new Promise((resolve) => setTimeout(resolve, 20));
    watcher.triggerRefresh();
    await new Promise((resolve) => setTimeout(resolve, 20));
    watcher.triggerRefresh();

    expect(refreshCalls).toBe(0);

    await new Promise((resolve) => setTimeout(resolve, 70));
    expect(refreshCalls).toBe(1);

    watcher.dispose();
  });

  it('should suppress refresh triggers when isSaving returns true', async () => {
    let refreshCalls = 0;
    let isSaving = true;

    const watcher = new SourceFileWatcher({
      debounceMs: 40,
      isSaving: () => isSaving,
      onRefresh: () => {
        refreshCalls++;
      }
    });

    watcher.triggerRefresh();
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(refreshCalls).toBe(0);

    isSaving = false;
    watcher.triggerRefresh();
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(refreshCalls).toBe(1);

    watcher.dispose();
  });

  it('should cancel pending execution on cancelPending or dispose', async () => {
    let refreshCalls = 0;

    const watcher = new SourceFileWatcher({
      debounceMs: 50,
      onRefresh: () => {
        refreshCalls++;
      }
    });

    watcher.triggerRefresh();
    watcher.cancelPending();

    await new Promise((resolve) => setTimeout(resolve, 70));
    expect(refreshCalls).toBe(0);

    watcher.triggerRefresh();
    watcher.dispose();

    await new Promise((resolve) => setTimeout(resolve, 70));
    expect(refreshCalls).toBe(0);
  });

  it('should interface with injected vscodeApi mocked watcher and text document listener', async () => {
    let changeHandler: ((uri: UriLike) => void) | undefined;
    let docChangeHandler: ((e: any) => void) | undefined;
    let refreshCalls = 0;
    let fsWatcherDisposed = false;
    let docSubDisposed = false;

    const mockTargetUri: UriLike = {
      fsPath: '/workspace/app.html',
      scheme: 'file',
      toString: () => 'file:///workspace/app.html'
    };

    const mockVscodeApi = {
      workspace: {
        createFileSystemWatcher: (pattern: string) => {
          expect(pattern).toBe('**/*.{html,css,js}');
          return {
            onDidChange: (cb: (uri: UriLike) => void) => {
              changeHandler = cb;
            },
            onDidCreate: () => {},
            onDidDelete: () => {},
            dispose: () => {
              fsWatcherDisposed = true;
            }
          };
        },
        onDidChangeTextDocument: (cb: (e: any) => void) => {
          docChangeHandler = cb;
          return {
            dispose: () => {
              docSubDisposed = true;
            }
          };
        }
      }
    };

    const watcher = new SourceFileWatcher({
      targetUri: mockTargetUri,
      htmlContent: '<link rel="stylesheet" href="style.css">',
      globPattern: '**/*.{html,css,js}',
      debounceMs: 30,
      vscodeApi: mockVscodeApi,
      onRefresh: () => {
        refreshCalls++;
      }
    });

    expect(watcher.getRelatedFilePaths()).toContain('style.css');
    expect(changeHandler).toBeDefined();
    expect(docChangeHandler).toBeDefined();

    // Simulate file system change event for linked style.css
    const styleUri: UriLike = {
      fsPath: '/workspace/style.css',
      scheme: 'file',
      toString: () => 'file:///workspace/style.css'
    };
    changeHandler?.(styleUri);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(refreshCalls).toBe(1);

    // Simulate active text document edit event
    docChangeHandler?.({ document: { uri: mockTargetUri } });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(refreshCalls).toBe(2);

    watcher.dispose();
    expect(fsWatcherDisposed).toBe(true);
    expect(docSubDisposed).toBe(true);
  });
});
