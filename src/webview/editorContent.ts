import codiconCSS from './codicon.css' with { type: 'text' };
import scriptJS from './script.js' with { type: 'text' };
import styleCSS from './style.css' with { type: 'text' };
import templateHTML from './template.html' with { type: 'text' };

/**
 * Generates the Webview HTML content for the Visual HTML Editor.
 * Decouples template.html, style.css, codicon.css, and script.js for clean maintainability.
 */
export function getWebviewContent(
  htmlContent: string,
  baseUri: string | null = null,
  autoSaveEnabled: boolean = false
): string {
  // Safely escape HTML/script tags so embedded HTML won't break the webview script tag
  const safeContent = JSON.stringify(htmlContent)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  const safeBaseUri = baseUri ? JSON.stringify(baseUri) : 'null';

  const fullScript = (scriptJS as unknown as string)
    .replace('"__RAW_HTML_PLACEHOLDER__"', safeContent)
    .replace('"__BASE_URI_PLACEHOLDER__"', safeBaseUri)
    .replace('"__AUTO_SAVE_ENABLED_PLACEHOLDER__"', JSON.stringify(autoSaveEnabled));

  const templateStr = (templateHTML as unknown as string)
    .replace('/* __CODICON_PLACEHOLDER__ */', codiconCSS as unknown as string)
    .replace('/* __STYLE_PLACEHOLDER__ */', styleCSS as unknown as string)
    .replace('/* __SCRIPT_PLACEHOLDER__ */', fullScript);

  return templateStr;
}
