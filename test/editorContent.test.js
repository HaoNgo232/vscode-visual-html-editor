const { describe, it } = require('node:test');
const assert = require('assert');
const { getWebviewContent } = require('../src/webview/editorContent');

describe('Webview Editor Content Test Suite', () => {
  it('should generate valid webview HTML containing initial content', () => {
    const sampleHTML = '<h1>Hello World</h1>';
    const webviewHTML = getWebviewContent(sampleHTML);

    assert.ok(webviewHTML.includes('<!DOCTYPE html>'));
    assert.ok(webviewHTML.includes('acquireVsCodeApi'));
    assert.ok(webviewHTML.includes('Hello World'));
    assert.ok(webviewHTML.includes('doc.designMode = \'on\''));
    assert.ok(webviewHTML.includes('zoomChange'));
  });
});
