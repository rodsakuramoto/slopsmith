const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createWindow, ROOT } = require('./capabilities_test_harness');

const CAPABILITIES_JS = path.join(ROOT, 'static', 'capabilities.js');
const AUDIO_SESSION_JS = path.join(ROOT, 'static', 'capabilities', 'audio-session.js');

function loadAudioSession(options = {}) {
    const window = createWindow(options);
    const context = vm.createContext(window);
    vm.runInContext(fs.readFileSync(CAPABILITIES_JS, 'utf8'), context, { filename: CAPABILITIES_JS });
    vm.runInContext(fs.readFileSync(AUDIO_SESSION_JS, 'utf8'), context, { filename: AUDIO_SESSION_JS });
    window.__vmContext = context;
    return window;
}

function runBrowserScript(window, relativePath) {
    const filePath = path.join(ROOT, relativePath);
    vm.runInContext(fs.readFileSync(filePath, 'utf8'), window.__vmContext, { filename: filePath });
}

function installMixerDom(window) {
    const elements = new Map();
    const audio = { volume: 0, src: '', load() {} };
    elements.set('audio', audio);
    elements.set('btn-mixer', { setAttribute() {}, focus() {}, contains: () => false });
    elements.set('mixer-popover', { innerHTML: '', classList: { add() {}, remove() {} }, contains: () => false, appendChild() {} });
    window.Event = class Event { constructor(type) { this.type = type; } };
    window.document.readyState = 'complete';
    window.document.getElementById = id => elements.get(id) || null;
    window.document.addEventListener = () => {};
    window.document.removeEventListener = () => {};
    window.document.createElement = tagName => ({
        tagName,
        className: '',
        textContent: '',
        value: '',
        style: {},
        setAttribute() {},
        appendChild() {},
        addEventListener() {},
    });
    return { elements, audio };
}

module.exports = { loadAudioSession, runBrowserScript, installMixerDom, ROOT };