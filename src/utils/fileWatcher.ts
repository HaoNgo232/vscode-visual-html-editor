import * as path from 'node:path';
import * as parse5 from 'parse5';
import { type DebouncedFunction, debounce } from './debounceUtils';

export interface UriLike {
  fsPath?: string;
  scheme?: string;
  toString(): string;
}

export interface DisposableLike {
  dispose(): void;
}

export interface FileWatcherOptions {
  /** Target document URI being edited */
  targetUri?: UriLike;
  /** Initial HTML content of target document to extract related dependencies */
  htmlContent?: string;
  /** Glob pattern for file system watcher (default: glob matching html, css, js) */
  globPattern?: string;
  /** Callback triggered when document needs to be refreshed */
  onRefresh: (changedUri?: UriLike) => void;
  /** Function returning true if save operation is in progress (prevents echo/loop) */
  isSaving?: () => boolean;
  /** Function returning true if refresh is allowed (e.g. !isDirty) */
  canRefresh?: () => boolean;
  /** Debounce delay in milliseconds (default: 300ms) */
  debounceMs?: number;
  /** Enable watching workspace-wide source files (default: true) */
  watchWorkspaceFiles?: boolean;
  /** Optional injected VS Code API module (for testing or custom environments) */
  vscodeApi?: any;
}

function addCleanPath(rawVal: string, paths: Set<string>): void {
  const val = rawVal?.trim();
  if (
    val &&
    !val.startsWith('http://') &&
    !val.startsWith('https://') &&
    !val.startsWith('//') &&
    !val.startsWith('data:') &&
    !val.startsWith('blob:') &&
    !val.startsWith('javascript:') &&
    !val.startsWith('mailto:') &&
    !val.startsWith('tel:') &&
    !val.startsWith('#')
  ) {
    let cleanPath = val.split('?')[0].split('#')[0];
    try {
      cleanPath = decodeURIComponent(cleanPath);
    } catch {
      // Fallback to raw string
    }
    if (cleanPath && (cleanPath.includes('.') || cleanPath.includes('/'))) {
      paths.add(cleanPath);
    }
  }
}

function extractCssUrls(cssText: string, paths: Set<string>): void {
  if (!cssText) return;
  const cssUrlRegex =
    /(?:@import\s+)?(?:url\s*\(\s*["']?([^"')]+)["']?\s*\)|@import\s+["']([^"']+)["'])/gi;
  let match: RegExpExecArray | null = cssUrlRegex.exec(cssText);
  while (match !== null) {
    const val = match[1] || match[2];
    if (val) addCleanPath(val, paths);
    match = cssUrlRegex.exec(cssText);
  }
}

function extractJsImports(jsText: string, paths: Set<string>): void {
  if (!jsText) return;
  const jsImportRegex =
    /(?:import|export)\s+.*?\s+from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/gi;
  let match: RegExpExecArray | null = jsImportRegex.exec(jsText);
  while (match !== null) {
    const val = match[1] || match[2];
    if (val) addCleanPath(val, paths);
    match = jsImportRegex.exec(jsText);
  }
}

/**
 * AST-driven HTML & Asset dependency extractor powered by parse5.
 * Eliminates regex attribute hardcoding by traversing every AST node,
 * attribute, style block, and script module in the HTML document.
 */
export function extractRelatedFilePathsAST(htmlContent: string): string[] {
  if (!htmlContent) return [];
  const paths = new Set<string>();

  try {
    const doc = parse5.parse(htmlContent);

    function walk(node: any): void {
      if (!node) return;

      // 1. Traverse all element attributes without hardcoded attribute lists
      if (node.attrs && Array.isArray(node.attrs)) {
        for (const attr of node.attrs) {
          const val = attr.value?.trim();
          if (!val) continue;

          if (attr.name === 'srcset') {
            const candidates = val.split(',');
            for (const cand of candidates) {
              const urlCand = cand.trim().split(/\s+/)[0];
              if (urlCand) addCleanPath(urlCand, paths);
            }
          } else if (attr.name === 'style') {
            extractCssUrls(val, paths);
          } else {
            addCleanPath(val, paths);
          }
        }
      }

      // 2. Traverse inline <style> block text nodes
      if (node.tagName === 'style' && node.childNodes) {
        for (const child of node.childNodes) {
          if (child.value) {
            extractCssUrls(child.value, paths);
          }
        }
      }

      // 3. Traverse inline <script> block text nodes
      if (node.tagName === 'script' && node.childNodes) {
        for (const child of node.childNodes) {
          if (child.value) {
            extractJsImports(child.value, paths);
          }
        }
      }

      // Recursive AST traversal
      if (node.childNodes && Array.isArray(node.childNodes)) {
        for (const child of node.childNodes) {
          walk(child);
        }
      }
    }

    walk(doc);
  } catch (err) {
    console.warn('[SourceFileWatcher] AST parse notice, falling back:', err);
  }

  return Array.from(paths);
}

/**
 * Backward-compatible export alias for extractRelatedFilePathsAST.
 */
export const extractRelatedFilePaths = extractRelatedFilePathsAST;

/**
 * Deterministically resolve a relative path against a base directory using path.resolve.
 */
export function resolvePathDeterministic(baseDir: string, relPath: string): string {
  const normRel = relPath.replace(/\\/g, '/');
  if (path.isAbsolute(normRel)) {
    return path.normalize(normRel).toLowerCase();
  }
  return path.resolve(baseDir, normRel).toLowerCase();
}

/**
 * Helper to check if a changed URI is related to the target document or its dependencies.
 * Performs directory tree hierarchy checks and AST-extracted asset path resolution.
 */
export function isUriRelated(
  changedUri: UriLike,
  targetUri?: UriLike,
  relatedFilePaths: string[] = []
): boolean {
  if (!targetUri) return true;

  const targetFsPath = targetUri.fsPath
    ? path.normalize(targetUri.fsPath).toLowerCase()
    : undefined;
  const changedFsPath = changedUri.fsPath
    ? path.normalize(changedUri.fsPath).toLowerCase()
    : undefined;

  if (!changedFsPath) return false;

  // 1. Direct match with target document
  if (targetFsPath && changedFsPath === targetFsPath) {
    return true;
  }

  const targetDir = targetFsPath ? path.dirname(targetFsPath) : undefined;
  const changedDir = path.dirname(changedFsPath);

  // 2. Check if changedUri resides inside targetUri's directory tree or subdirectories
  if (targetDir) {
    const normTargetDir = targetDir.endsWith(path.sep) ? targetDir : targetDir + path.sep;
    const normTargetDirAlt = targetDir.endsWith('/') ? targetDir : targetDir + '/';
    if (
      changedDir === targetDir ||
      changedFsPath.startsWith(normTargetDir) ||
      changedFsPath.startsWith(normTargetDirAlt)
    ) {
      return true;
    }
  }

  // 3. Match resolved absolute paths of AST-extracted dependencies
  if (targetDir && relatedFilePaths.length > 0) {
    for (const relPath of relatedFilePaths) {
      const resolvedAbs = resolvePathDeterministic(targetDir, relPath);
      if (changedFsPath === resolvedAbs) {
        return true;
      }
      const cleanRel = relPath
        .replace(/^(\.\/|\/)+/, '')
        .replace(/\\/g, '/')
        .toLowerCase();
      if (cleanRel && (changedFsPath.endsWith(cleanRel) || changedFsPath.includes(cleanRel))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * FileWatcher module to monitor source code changes and trigger document refresh.
 * Tracks target document, directory tree hierarchy, and AST-extracted dependencies.
 */
export class SourceFileWatcher implements DisposableLike {
  private subscriptions: DisposableLike[] = [];
  private debouncedRefresh: DebouncedFunction<(uri?: UriLike) => void>;
  private relatedFilePaths: string[] = [];

  constructor(private options: FileWatcherOptions) {
    const delay = options.debounceMs ?? 300;

    if (options.htmlContent) {
      this.relatedFilePaths = extractRelatedFilePathsAST(options.htmlContent);
    }

    this.debouncedRefresh = debounce((uri?: UriLike) => {
      if (this.options.isSaving?.()) {
        return;
      }
      if (this.options.canRefresh?.() === false) {
        return;
      }
      this.options.onRefresh(uri);
    }, delay);

    this.setupWatcher();
  }

  /** Update HTML content to dynamically re-extract related file dependencies via AST */
  public updateHtmlContent(htmlContent: string): void {
    this.relatedFilePaths = extractRelatedFilePathsAST(htmlContent);
  }

  /** Get list of currently tracked relative dependency paths */
  public getRelatedFilePaths(): string[] {
    return [...this.relatedFilePaths];
  }

  private resolveVscodeApi(): any {
    if (this.options.vscodeApi) {
      return this.options.vscodeApi;
    }
    try {
      return require('vscode');
    } catch {
      return undefined;
    }
  }

  private setupWatcher(): void {
    const vscode = this.resolveVscodeApi();
    if (!vscode?.workspace) {
      return;
    }

    const targetUri = this.options.targetUri;
    const pattern = this.options.globPattern ?? '**/*';

    // 1. Setup File System Watcher for disk changes across project tree
    if (this.options.watchWorkspaceFiles !== false && vscode.workspace.createFileSystemWatcher) {
      try {
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);

        const handleChange = (uri: UriLike) => {
          if (isUriRelated(uri, targetUri, this.relatedFilePaths)) {
            this.triggerRefresh(uri);
          }
        };

        if (watcher.onDidChange) watcher.onDidChange(handleChange);
        if (watcher.onDidCreate) watcher.onDidCreate(handleChange);
        if (watcher.onDidDelete) watcher.onDidDelete(handleChange);

        if (typeof watcher.dispose === 'function') {
          this.subscriptions.push(watcher);
        }
      } catch (err) {
        console.error('[SourceFileWatcher] Failed to create FileSystemWatcher:', err);
      }
    }

    // 2. Setup Text Document Change Listener for active workspace edits
    if (targetUri && vscode.workspace.onDidChangeTextDocument) {
      try {
        const docSub = vscode.workspace.onDidChangeTextDocument((e: any) => {
          if (e.document?.uri && isUriRelated(e.document.uri, targetUri, this.relatedFilePaths)) {
            this.triggerRefresh(e.document.uri);
          }
        });
        if (docSub && typeof docSub.dispose === 'function') {
          this.subscriptions.push(docSub);
        }
      } catch (err) {
        console.error('[SourceFileWatcher] Failed to register onDidChangeTextDocument:', err);
      }
    }
  }

  /** Manually trigger a debounced refresh */
  public triggerRefresh(uri?: UriLike): void {
    if (this.options.isSaving?.()) {
      return;
    }
    this.debouncedRefresh(uri);
  }

  /** Cancel any pending refresh execution */
  public cancelPending(): void {
    this.debouncedRefresh.cancel();
  }

  /** Clean up all watchers and listeners */
  public dispose(): void {
    this.cancelPending();
    for (const sub of this.subscriptions) {
      try {
        sub.dispose();
      } catch {
        // Ignore dispose error
      }
    }
    this.subscriptions = [];
  }
}
