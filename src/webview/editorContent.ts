import templateHTML from './template.html' with { type: 'text' };

/**
 * Generates the Webview HTML content for the Visual HTML Editor.
 * Loads template.html and injects raw HTML and base URI safely.
 */
export function getWebviewContent(htmlContent: string, baseUri: string | null = null): string {
  // Safely escape HTML/script tags so embedded HTML won't break the webview script tag
  const safeContent = JSON.stringify(htmlContent)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  const safeBaseUri = baseUri ? JSON.stringify(baseUri) : 'null';

  const templateStr = templateHTML as unknown as string;

  return templateStr
    .replace('"__RAW_HTML_PLACEHOLDER__"', safeContent)
    .replace('"__BASE_URI_PLACEHOLDER__"', safeBaseUri);
}
