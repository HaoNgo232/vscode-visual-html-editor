import { beforeAll, describe, expect, it } from 'bun:test';
import {
  prepareDocumentHtml,
  registerMutationTracker,
  resolveNestedIframes
} from '../src/webview/modules/documentRuntime';

describe('Document Runtime Module Test Suite (Bun)', () => {
  beforeAll(() => {
    if (typeof globalThis.DOMParser === 'undefined') {
      class MockNode {
        nodeType = 1;
        tagName: string;
        id = '';
        attributes = new Map<string, string>();
        children: MockNode[] = [];
        parentElement: MockNode | null = null;
        listeners: Record<string, Function[]> = {};

        constructor(tagName = 'div') {
          this.tagName = tagName;
        }

        get href() {
          return this.attributes.get('href') || '';
        }
        set href(v: string) {
          this.attributes.set('href', v);
        }

        setAttribute(k: string, v: string) {
          if (k === 'id') this.id = v;
          this.attributes.set(k, v);
        }

        getAttribute(k: string) {
          return this.attributes.get(k) || null;
        }

        hasAttribute(k: string) {
          return this.attributes.has(k);
        }

        removeAttribute(k: string) {
          this.attributes.delete(k);
        }

        querySelector(sel: string): MockNode | null {
          if (sel.startsWith('#') && this.id === sel.slice(1)) return this;
          if (
            sel.startsWith('[data-runtime-id="') &&
            this.getAttribute('data-runtime-id') === sel.slice(18, -2)
          )
            return this;
          for (const c of this.children) {
            const found = c.querySelector(sel);
            if (found) return found;
          }
          return null;
        }

        querySelectorAll(sel: string): MockNode[] {
          const results: MockNode[] = [];
          if (
            sel === 'iframe[src]' &&
            this.tagName.toLowerCase() === 'iframe' &&
            this.hasAttribute('src')
          ) {
            results.push(this);
          }
          for (const c of this.children) {
            results.push(...c.querySelectorAll(sel));
          }
          return results;
        }

        insertBefore(node: MockNode, _ref: any) {
          node.parentElement = this;
          this.children.unshift(node);
        }

        appendChild(node: MockNode) {
          node.parentElement = this;
          this.children.push(node);
        }

        addEventListener(type: string, fn: Function) {
          this.listeners[type] = this.listeners[type] || [];
          this.listeners[type].push(fn);
        }

        dispatchEvent(evt: { type: string; target?: MockNode; bubbles?: boolean }) {
          evt.target = evt.target || this;
          const list = this.listeners[evt.type] || [];
          for (const fn of list) fn(evt);
          if (evt.bubbles && this.parentElement) {
            this.parentElement.dispatchEvent(evt);
          }
        }

        get outerHTML(): string {
          let attrs = '';
          if (this.id) {
            attrs += ` id="${this.id}"`;
          }
          for (const [k, v] of this.attributes.entries()) {
            if (k !== 'id') {
              attrs += ` ${k}="${v}"`;
            }
          }
          const inner: string = this.children.map((c: MockNode): string => c.outerHTML).join('');
          return `<${this.tagName.toLowerCase()}${attrs}>${inner}</${this.tagName.toLowerCase()}>`;
        }
      }

      class MockDoc extends MockNode {
        head = new MockNode('head');
        body = new MockNode('body');
        documentElement = new MockNode('html');

        constructor() {
          super('document');
          this.documentElement.appendChild(this.head);
          this.documentElement.appendChild(this.body);
          this.head.parentElement = this.documentElement;
          this.body.parentElement = this.documentElement;
        }

        createElement(tag: string) {
          return new MockNode(tag);
        }

        querySelector(sel: string) {
          return this.documentElement.querySelector(sel);
        }

        querySelectorAll(sel: string) {
          return this.documentElement.querySelectorAll(sel);
        }
      }

      (globalThis as any).DOMParser = class {
        parseFromString(htmlStr: string) {
          const doc = new MockDoc();
          if (htmlStr.includes('elem_456')) {
            const elem = doc.createElement('div');
            elem.setAttribute('data-runtime-id', 'elem_456');
            doc.body.appendChild(elem);
          }
          if (htmlStr.includes('iframe src=')) {
            const ifrm = doc.createElement('iframe');
            ifrm.setAttribute('src', 'child.html');
            doc.body.appendChild(ifrm);
          }
          return doc as any;
        }
      };
    }
  });

  it('should prepare document HTML by injecting base tag and fetch polyfill script', () => {
    const rawHtml = '<!DOCTYPE html><html><head></head><body><h1>Hello World</h1></body></html>';
    const baseUri = 'vscode-webview://workspace/folder/';
    const prepared = prepareDocumentHtml(rawHtml, baseUri);

    expect(prepared).toContain('<!DOCTYPE html>');
    expect(prepared).toContain(`base href="${baseUri}"`);
    expect(prepared).toContain('id="vhe-fetch-polyfill"');
    expect(prepared).toContain('data-vhe-injected="fetch-polyfill"');
  });

  it('should preserve existing DOCTYPE declaration in prepareDocumentHtml', () => {
    const customDoctype = '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN">';
    const rawHtml = `${customDoctype}<html><head></head><body><p>Test</p></body></html>`;
    const prepared = prepareDocumentHtml(rawHtml, null);

    expect(prepared).toContain('<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN">');
    expect(prepared).toContain('data-vhe-injected="fetch-polyfill"');
  });

  it('should register mutation tracking listeners and mark dirty runtime IDs on input events', () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      '<html><body><div data-runtime-id="elem_456">Editable</div></body></html>',
      'text/html'
    );

    const dirtyRuntimeIds = new Set<string>();
    let dirtyStateCall = false;
    let debouncedSaveCall = false;

    const mockSaveModule = {
      setDirtyState: (dirty: boolean) => {
        dirtyStateCall = dirty;
      },
      debouncedSave: () => {
        debouncedSaveCall = true;
      }
    };

    registerMutationTracker(doc as any, dirtyRuntimeIds, mockSaveModule);

    const targetElem = doc.querySelector('[data-runtime-id="elem_456"]');
    expect(targetElem).not.toBeNull();

    if (targetElem) {
      (doc as any).dispatchEvent({ type: 'input', target: targetElem, bubbles: true });

      expect(dirtyRuntimeIds.has('elem_456')).toBe(true);
      expect(dirtyStateCall).toBe(true);
      expect(debouncedSaveCall).toBe(true);
    }
  });

  it('should identify relative iframe sources in resolveNestedIframes without throwing exceptions', () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      '<html><body><iframe src="child.html"></iframe></body></html>',
      'text/html'
    );

    expect(() => resolveNestedIframes(doc as any, 'http://localhost:3000/')).not.toThrow();
  });
});
