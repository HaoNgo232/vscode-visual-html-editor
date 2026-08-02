/**
 * Typed IPC Protocol for Visual HTML Editor.
 * Communication bridge between VS Code Extension Host and Webview Panel using Discriminated Unions.
 */

export type ToggleAutoSaveMessage = {
  command: 'toggleAutoSave';
  enabled: boolean;
};

export type FetchLocalFileMessage = {
  command: 'fetchLocalFile';
  requestId: string;
  relativePath: string;
};

export type SetDirtyMessage = {
  command: 'setDirty';
  isDirty: boolean;
  html?: string | null;
};

export type ReloadDocumentMessage = {
  command: 'reloadDocument';
};

export type ExportPdfMessage = {
  command: 'exportPdf';
  html: string;
};

export type SaveMessage = {
  command: 'save';
  html: string;
  forceOverwrite?: boolean;
  fallbackHtml?: string;
};

export type SaveSurgicalMessage = {
  command: 'saveSurgical';
  changes?: Array<{ runtimeId: string; newInnerHTML: string }>;
  fallbackHtml?: string;
  html?: string;
  forceOverwrite?: boolean;
};

export type WebviewToHostMessage =
  | ToggleAutoSaveMessage
  | FetchLocalFileMessage
  | SetDirtyMessage
  | ReloadDocumentMessage
  | ExportPdfMessage
  | SaveMessage
  | SaveSurgicalMessage;

export type ForceReloadMessage = {
  command: 'forceReload';
  taggedHtml: string;
};

export type SaveCompletedSuccessMessage = {
  command: 'saveCompleted';
  success: true;
  taggedHtml?: string;
};

export type SaveCompletedErrorMessage = {
  command: 'saveCompleted';
  success: false;
  error?: string;
};

export type SaveCompletedMessage = SaveCompletedSuccessMessage | SaveCompletedErrorMessage;

export type FetchLocalFileResponseSuccessMessage = {
  command: 'fetchLocalFileResponse';
  requestId: string;
  success: true;
  content: string;
};

export type FetchLocalFileResponseErrorMessage = {
  command: 'fetchLocalFileResponse';
  requestId: string;
  success: false;
  error: string;
};

export type FetchLocalFileResponseMessage =
  | FetchLocalFileResponseSuccessMessage
  | FetchLocalFileResponseErrorMessage;

export type HostToWebviewMessage =
  | ForceReloadMessage
  | SaveCompletedMessage
  | FetchLocalFileResponseMessage;

/**
 * Exhaustiveness check helper for Discriminated Unions in switch/case branches.
 */
export function assertNever(x: never): never {
  throw new Error(`[Visual HTML Editor IPC Protocol] Unhandled IPC command: ${JSON.stringify(x)}`);
}
