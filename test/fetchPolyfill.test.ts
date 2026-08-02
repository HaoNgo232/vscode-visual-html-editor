import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { initFetchPolyfill } from '../src/webview/modules/polyfill';

type EventListenerFn = (...args: any[]) => void;

describe('Fetch Polyfill Runtime Protocol & Timeout/Abort Suite (Bun)', () => {
  let originalWindow: any;

  beforeEach(() => {
    originalWindow = (globalThis as any).window;

    const listeners: Record<string, EventListenerFn[]> = {};

    (globalThis as any).window = {
      __vhe_polyfill_injected: false,
      fetch: async () => new Response('original'),
      addEventListener: (type: string, fn: EventListenerFn) => {
        listeners[type] = listeners[type] || [];
        listeners[type].push(fn);
      },
      removeEventListener: (type: string, fn: EventListenerFn) => {
        if (listeners[type]) {
          listeners[type] = listeners[type].filter((l) => l !== fn);
        }
      },
      parent: {
        postMessage: (msg: any) => {
          // Simulate IPC message handling in mock window
          if (msg && msg.command === 'fetchLocalFile') {
            setTimeout(() => {
              const event = {
                data: {
                  command: 'fetchLocalFileResponse',
                  requestId: msg.requestId,
                  success: msg.relativePath !== 'nonexistent.html',
                  content: msg.relativePath === 'nonexistent.html' ? null : '<h1>Mock Content</h1>',
                  error: msg.relativePath === 'nonexistent.html' ? 'File not found' : null
                }
              };
              for (const l of listeners.message || []) {
                l(event);
              }
            }, 5);
          }
        }
      },
      _listeners: listeners
    };

    // Polyfill DOMException if missing in bun test env
    if (typeof globalThis.DOMException === 'undefined') {
      (globalThis as any).DOMException = class DOMException extends Error {
        constructor(message?: string, name?: string) {
          super(message);
          this.name = name || 'Error';
        }
      };
    }
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
  });

  it('should resolve local relative fetch with 200 OK when IPC returns success', async () => {
    initFetchPolyfill();
    const res = await window.fetch('components/header.html');

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('<h1>Mock Content</h1>');
  });

  it('should resolve local relative fetch with 404 Not Found when file missing', async () => {
    initFetchPolyfill();
    const res = await window.fetch('nonexistent.html');

    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text).toBe('File not found');
  });

  it('should clean up message listener after response is received', async () => {
    initFetchPolyfill();
    const win = window as any;
    expect(win._listeners.message?.length || 0).toBe(0);

    const fetchPromise = window.fetch('components/header.html');
    expect(win._listeners.message?.length || 0).toBe(1);

    await fetchPromise;
    expect(win._listeners.message?.length || 0).toBe(0);
  });

  it('should handle AbortController abort signal and clean up listener', async () => {
    initFetchPolyfill();
    const win = window as any;
    const controller = new AbortController();

    // Prevent parent postMessage from immediately completing
    win.parent.postMessage = () => {};

    const fetchPromise = window.fetch('components/slow.html', { signal: controller.signal });
    expect(win._listeners.message?.length || 0).toBe(1);

    controller.abort();

    try {
      await fetchPromise;
      expect(true).toBe(false); // Should not reach here
    } catch (err: any) {
      expect(err.name).toBe('AbortError');
    }

    expect(win._listeners.message?.length || 0).toBe(0);
  });
});
