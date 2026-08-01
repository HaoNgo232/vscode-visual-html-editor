import { describe, expect, it } from 'bun:test';
import { debounce } from '../src/utils/debounceUtils';

describe('Debounce Utility Test Suite (Bun)', () => {
  it('should delay function execution by specified wait time', async () => {
    let callCount = 0;
    const fn = debounce(() => {
      callCount++;
    }, 50);

    fn();
    expect(callCount).toBe(0);

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(callCount).toBe(1);
  });

  it('should reset timer if invoked again before delay passes', async () => {
    let callCount = 0;
    let lastValue = '';
    const fn = debounce((val: string) => {
      callCount++;
      lastValue = val;
    }, 60);

    fn('first');
    await new Promise((resolve) => setTimeout(resolve, 30));
    fn('second');
    await new Promise((resolve) => setTimeout(resolve, 30));
    fn('third');
    expect(callCount).toBe(0);

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(callCount).toBe(1);
    expect(lastValue).toBe('third');
  });

  it('should cancel pending execution when cancel() is called', async () => {
    let callCount = 0;
    const fn = debounce(() => {
      callCount++;
    }, 50);

    fn();
    fn.cancel();

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(callCount).toBe(0);
  });
});
