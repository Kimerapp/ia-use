const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { AI_PROVIDERS } = require('../src/shared/providers');

function injector() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync('src/renderer/injector.js', 'utf8'), context);
  return context.window.IAUseInjector;
}

test('Claude capture does not return an old answer during streaming', () => {
  const provider = AI_PROVIDERS.find(p => p.id === 'claude');
  const document = { querySelectorAll(selector) {
    if (selector === '[data-is-streaming="true"]') return [{}];
    if (selector.includes('font-claude-message')) return [{ innerText: 'Previous completed answer' }];
    return [];
  }};
  const result = vm.runInNewContext(injector().buildCaptureResponseScript(provider), { document, window: { getSelection: () => '' } });
  assert.equal(result.ok, false);
});

test('sandbox preload sends clipboard through IPC', () => {
  let api; const calls = [];
  vm.runInNewContext(fs.readFileSync('src/main/preload.js', 'utf8'), { require: () => ({ contextBridge: { exposeInMainWorld: (_, value) => api = value }, ipcRenderer: { invoke: (...args) => calls.push(args), on() {} } }) });
  api.copyText('hello');
  assert.deepEqual(calls[0], ['clipboard-write', 'hello']);
});

function mainHarness() {
  const handlers = {}, events = {}, permissions = {}, opened = [];
  const aiSession = {
    setUserAgent() {}, setPermissionCheckHandler(fn) { permissions.check = fn; },
    setPermissionRequestHandler(fn) { permissions.request = fn; }, async clearStorageData() {}
  };
  const host = { mainFrame: {} };
  const mainWindow = { webContents: host, isDestroyed: () => false };
  const electron = {
    app: { on: (name, fn) => events[name] = fn, whenReady: () => ({ then() {} }) },
    BrowserWindow: {}, session: { fromPartition: () => aiSession }, Menu: {},
    shell: { openExternal: async url => opened.push(url) },
    ipcMain: { handle: (name, fn) => handlers[name] = fn },
    clipboard: { writeText: value => opened.push(value), readText: () => 'value' },
    dialog: { showMessageBox: async () => ({ response: 1 }) }
  };
  const context = { require: name => name === 'electron' ? electron : require(name), __dirname: '/tmp', URL, process };
  vm.runInNewContext(fs.readFileSync('src/main/main.js', 'utf8') + '\nmainWindow = testWindow; configureAISession();', { ...context, testWindow: mainWindow });
  return { handlers, events, permissions, opened, host, aiSession };
}

test('only host frame may access clipboard and open validated external links', async () => {
  const h = mainHarness();
  assert.throws(() => h.handlers['clipboard-write']({ sender: {}, senderFrame: {} }, 'x'), /autorizzata/);
  const event = { sender: h.host, senderFrame: h.host.mainFrame };
  await assert.rejects(h.handlers['open-external'](event, 'file:///etc/passwd'), /non valido/);
  await h.handlers['open-external'](event, 'https://example.com/');
  assert.equal(h.opened[0], 'https://example.com/');
});

test('permission requires matching trusted origin and explicit microphone consent', async () => {
  const h = mainHarness();
  const contents = { getURL: () => 'https://chatgpt.com/' };
  assert.equal(h.permissions.check(contents, 'media', 'https://chatgpt.com', { mediaType: 'audio' }), false);
  const request = (permission, details) => new Promise(resolve => h.permissions.request(contents, permission, resolve, details));
  assert.equal(await request('media', { requestingUrl: 'https://evil.example/', mediaTypes: ['audio'] }), false);
  assert.equal(await request('media', { requestingUrl: 'https://chatgpt.com/', mediaTypes: ['video'] }), false);
  assert.equal(await request('media', { requestingUrl: 'https://chatgpt.com/', mediaTypes: ['audio'] }), true);
});

test('popup handler rejects non-web schemes and deceptive auth hostnames', async () => {
  const h = mainHarness(); let handler;
  const contents = { getType: () => 'webview', setUserAgent() {}, setWindowOpenHandler(fn) { handler = fn; } };
  h.events['web-contents-created']({}, contents);
  assert.equal(handler({ url: 'file:///tmp/accounts.google.com' }).action, 'deny');
  assert.equal(handler({ url: 'https://accounts.google.com.attacker.example/' }).action, 'deny');
  assert.equal(handler({ url: 'https://accounts.google.com/' }).action, 'allow');
  assert.deepEqual(h.opened, ['https://accounts.google.com.attacker.example/']);
});

test('missing editor reports a safe-to-retry failure before modifying page', async () => {
  const provider = AI_PROVIDERS.find(p => p.id === 'chatgpt');
  const result = await vm.runInNewContext(injector().buildInjectPromptScript(provider, 'prompt', true), {
    document: { querySelectorAll: () => [] }, window: {}
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'input-not-found');
});

test('Claude capture chooses the latest completed response', () => {
  const provider = AI_PROVIDERS.find(p => p.id === 'claude');
  const result = vm.runInNewContext(injector().buildCaptureResponseScript(provider), {
    document: { querySelectorAll(selector) {
      if (selector === '.font-claude-message') return [{ innerText: 'First answer' }, { innerText: 'Latest answer' }];
      return [];
    } }, window: { getSelection: () => '' }
  });
  assert.equal(result.text, 'Latest answer');
});

test('hidden target remains available until submit button is clicked once', async () => {
  const provider = { selectors: { input: ['textarea'], submit: ['button'] } };
  let clicks = 0;
  const input = { tagName: 'TEXTAREA', focus() {}, dispatchEvent() {}, getBoundingClientRect: () => ({ width: 20, height: 20 }) };
  const button = { click() { clicks++; }, getAttribute: () => null, getBoundingClientRect: () => ({ width: 20, height: 20 }) };
  const window = { getComputedStyle: () => ({ visibility: 'visible' }), HTMLTextAreaElement: function() {} };
  const result = vm.runInNewContext(injector().buildInjectPromptScript(provider, 'hello', true), {
    window, document: { querySelectorAll: selector => selector === 'textarea' ? [input] : [button] },
    InputEvent: class {}, Event: class {}, setTimeout
  });
  assert.equal(typeof result.then, 'function');
  assert.equal((await result).ok, true);
  assert.equal(clicks, 1);
});

test('disabled submit reports prepared text without simulating Enter', async () => {
  const provider = { selectors: { input: ['textarea'], submit: ['button'] } };
  let enterEvents = 0;
  const input = { tagName: 'TEXTAREA', focus() {}, dispatchEvent(event) { if (event.type === 'keydown') enterEvents++; }, getBoundingClientRect: () => ({ width: 20, height: 20 }) };
  const button = { disabled: true, click() { throw new Error('disabled button clicked'); }, getAttribute: () => 'true', getBoundingClientRect: () => ({ width: 20, height: 20 }) };
  const window = { getComputedStyle: () => ({ visibility: 'visible' }), HTMLTextAreaElement: function() {} };
  const result = await vm.runInNewContext(injector().buildInjectPromptScript(provider, 'hello', true), {
    window, document: { querySelectorAll: selector => selector === 'textarea' ? [input] : [button] },
    InputEvent: class { constructor(type) { this.type = type; } }, Event: class { constructor(type) { this.type = type; } }, KeyboardEvent: class { constructor(type) { this.type = type; } }, setTimeout: fn => fn(), Date: class extends Date { static now() { return now += 1000; } }
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'submit-unavailable');
  assert.equal(enterEvents, 0);
});
let now = 0;
