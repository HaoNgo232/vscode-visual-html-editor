import { describe, expect, it } from 'bun:test';
import { CommandRegistry } from '../src/webview/modules/commandRegistry';

describe('Command Registry Unit Test Suite (Bun)', () => {
  it('should register and execute commands correctly', () => {
    const registry = new CommandRegistry();
    let executed = false;
    let receivedArg = '';

    registry.register({
      id: 'test-command',
      group: 'document',
      execute: (arg: string) => {
        executed = true;
        receivedArg = arg;
      }
    });

    expect(registry.get('test-command')).toBeDefined();
    registry.execute('test-command', 'hello');

    expect(executed).toBe(true);
    expect(receivedArg).toBe('hello');
  });

  it('should handle non-existent commands gracefully without throwing', () => {
    const registry = new CommandRegistry();
    expect(() => {
      registry.execute('unknown-cmd');
    }).not.toThrow();
  });
});
