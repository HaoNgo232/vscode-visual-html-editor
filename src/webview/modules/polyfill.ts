/**
 * Fetch Polyfill Module for Visual HTML Editor.
 * Bridges relative file fetches inside webview iframes to the Extension Host filesystem.
 */

export function initFetchPolyfill(): void {
  const win = window as any;
  if (win.__vhe_polyfill_injected) return;
  win.__vhe_polyfill_injected = true;

  const originalFetch = window.fetch;
  const customFetch = async function (
    this: unknown,
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const url =
      typeof input === 'string' ? input : input && 'url' in input ? (input as any).url : '';
    if (
      url &&
      !url.startsWith('http://') &&
      !url.startsWith('https://') &&
      !url.startsWith('data:') &&
      !url.startsWith('blob:') &&
      !url.startsWith('vscode-webview:')
    ) {
      return new Promise((resolve) => {
        const requestId = `req_${Math.random().toString(36).substring(2, 11)}`;
        function handleResponse(event: MessageEvent) {
          const msg = event.data;
          if (msg && msg.command === 'fetchLocalFileResponse' && msg.requestId === requestId) {
            window.removeEventListener('message', handleResponse);
            if (msg.success) {
              resolve(
                new Response(msg.content, {
                  status: 200,
                  statusText: 'OK',
                  headers: { 'Content-Type': 'text/html; charset=utf-8' }
                })
              );
            } else {
              resolve(
                new Response(msg.error || 'File not found', {
                  status: 404,
                  statusText: 'Not Found'
                })
              );
            }
          }
        }
        window.addEventListener('message', handleResponse);
        window.parent.postMessage({ command: 'fetchLocalFile', requestId, relativePath: url }, '*');
      });
    }
    return originalFetch.call(window, input, init);
  };

  Object.assign(customFetch, originalFetch);
  window.fetch = customFetch as typeof fetch;
}

export function getPolyfillScriptString(): string {
  return `(${initFetchPolyfill.toString()})();`;
}
