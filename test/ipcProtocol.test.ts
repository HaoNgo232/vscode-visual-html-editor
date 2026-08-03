import { describe, expect, it } from 'bun:test';
import {
  assertNever,
  type HostToWebviewMessage,
  type WebviewToHostMessage
} from '../src/utils/ipcProtocol';

describe('Typed IPC Protocol Test Suite (Bun)', () => {
  it('should correctly handle all WebviewToHostMessage discriminators', () => {
    const messages: WebviewToHostMessage[] = [
      { command: 'toggleAutoSave', enabled: true },
      { command: 'fetchLocalFile', requestId: 'req_123', relativePath: 'styles.css' },
      { command: 'setDirty', isDirty: true, html: '<h1>Test</h1>' },
      { command: 'reloadDocument' },
      { command: 'exportPdf', html: '<html></html>' },
      { command: 'exportImage', html: '<html></html>' },
      { command: 'save', html: '<html></html>', forceOverwrite: true },
      { command: 'saveSurgical', changes: [{ runtimeId: 'elem_1', newInnerHTML: 'Hi' }] }
    ];

    const commandsProcessed: string[] = [];

    for (const msg of messages) {
      switch (msg.command) {
        case 'toggleAutoSave':
          commandsProcessed.push(`toggleAutoSave:${msg.enabled}`);
          break;
        case 'fetchLocalFile':
          commandsProcessed.push(`fetchLocalFile:${msg.requestId}:${msg.relativePath}`);
          break;
        case 'setDirty':
          commandsProcessed.push(`setDirty:${msg.isDirty}`);
          break;
        case 'reloadDocument':
          commandsProcessed.push('reloadDocument');
          break;
        case 'exportPdf':
          commandsProcessed.push('exportPdf');
          break;
        case 'exportImage':
          commandsProcessed.push('exportImage');
          break;
        case 'save':
          commandsProcessed.push(`save:${msg.forceOverwrite}`);
          break;
        case 'saveSurgical':
          commandsProcessed.push(`saveSurgical:${msg.changes?.length}`);
          break;
        default:
          assertNever(msg);
      }
    }

    expect(commandsProcessed).toEqual([
      'toggleAutoSave:true',
      'fetchLocalFile:req_123:styles.css',
      'setDirty:true',
      'reloadDocument',
      'exportPdf',
      'exportImage',
      'save:true',
      'saveSurgical:1'
    ]);
  });

  it('should correctly handle HostToWebviewMessage discriminators', () => {
    const hostMessages: HostToWebviewMessage[] = [
      { command: 'forceReload', taggedHtml: '<div></div>' },
      { command: 'saveCompleted', success: true, taggedHtml: '<div></div>' },
      { command: 'saveCompleted', success: false, error: 'Failed' },
      { command: 'fetchLocalFileResponse', requestId: 'req_1', success: true, content: 'css' },
      { command: 'fetchLocalFileResponse', requestId: 'req_2', success: false, error: '404' }
    ];

    let successCount = 0;
    for (const msg of hostMessages) {
      switch (msg.command) {
        case 'forceReload':
          expect(msg.taggedHtml).toBe('<div></div>');
          break;
        case 'saveCompleted':
          if (msg.success) {
            successCount++;
            expect(msg.taggedHtml).toBeDefined();
          } else {
            expect(msg.error).toBe('Failed');
          }
          break;
        case 'fetchLocalFileResponse':
          if (msg.success) {
            successCount++;
            expect(msg.content).toBe('css');
          } else {
            expect(msg.error).toBe('404');
          }
          break;
        default:
          assertNever(msg);
      }
    }

    expect(successCount).toBe(2);
  });

  it('should throw error in assertNever when unexpected message is passed', () => {
    expect(() => assertNever({ command: 'unknownCommand' } as never)).toThrow(
      '[Visual HTML Editor IPC Protocol] Unhandled IPC command'
    );
  });
});
