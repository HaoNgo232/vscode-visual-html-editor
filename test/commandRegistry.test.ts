import { describe, expect, it } from 'bun:test';
import { commandRegistry } from '../src/webview/modules/commandRegistry';

describe('Command Registry Unit Test Suite (Bun)', () => {
  it('should register and execute commands correctly', () => {
    let executed = false;
    let receivedArg = '';

    commandRegistry.register({
      id: 'test-command',
      group: 'document',
      execute: (arg: string) => {
        executed = true;
        receivedArg = arg;
      }
    });

    expect(commandRegistry.get('test-command')).toBeDefined();
    commandRegistry.execute('test-command', 'hello');

    expect(executed).toBe(true);
    expect(receivedArg).toBe('hello');
  });

  it('should handle non-existent commands gracefully without throwing', () => {
    expect(() => {
      commandRegistry.execute('unknown-cmd');
    }).not.toThrow();
  });
});
