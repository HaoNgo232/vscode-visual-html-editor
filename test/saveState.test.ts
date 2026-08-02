import { describe, expect, it } from 'bun:test';
import { removeInjectedRuntimeNodes } from '../src/webview/modules/saveState';

describe('Save State Runtime Cleanup', () => {
  it('should remove only fetch polyfill nodes carrying the internal marker', () => {
    let selectorUsed = '';
    let removedCount = 0;

    const root = {
      querySelectorAll: (selector: string) => {
        selectorUsed = selector;

        return [
          {
            remove: () => {
              removedCount++;
            }
          },
          {
            remove: () => {
              removedCount++;
            }
          }
        ];
      }
    } as unknown as ParentNode;

    removeInjectedRuntimeNodes(root);

    expect(selectorUsed).toBe('[data-vhe-injected="fetch-polyfill"]');
    expect(removedCount).toBe(2);
  });

  it('should not throw when no injected runtime nodes exist', () => {
    const root = {
      querySelectorAll: () => []
    } as unknown as ParentNode;

    expect(() => removeInjectedRuntimeNodes(root)).not.toThrow();
  });
});
