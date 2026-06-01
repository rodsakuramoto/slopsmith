const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadAudioSession } = require('./audio_session_test_harness');

test('active audio domains expose expected legacy shim metadata', () => {
    const window = loadAudioSession();
    const shims = window.slopsmith.capabilities.snapshotDiagnostics().compatibilityShims;
    for (const shimId of ['audio-mix.fader-registry', 'audio-mix.song-volume', 'audio-mix.analyser', 'audio-input.legacy-source', 'audio-monitoring.audio-barrier', 'stems.master-volume', 'stems.private-state']) {
        assert.equal(shims.some(shim => shim.shimId === shimId && shim.status === 'active'), true, shimId);
    }
});

test('legacy bridge hit counts are attributed to canonical audio domains', () => {
    const window = loadAudioSession();
    const audioSession = window.slopsmith.audioSession;
    audioSession.recordBridgeHit({ domain: 'audio-mix', bridgeId: 'audio-mix.analyser', legacySurface: 'HTMLAudioElement analyser tap', participantId: 'highway_3d' });
    audioSession.recordBridgeHit({ domain: 'audio-input', bridgeId: 'audio-input.legacy-source', legacySurface: 'navigator.mediaDevices.getUserMedia', participantId: 'note_detect' });
    audioSession.recordBridgeHit({ domain: 'audio-monitoring', bridgeId: 'audio-monitoring.audio-barrier', legacySurface: 'window.slopsmithAudioBarrier', participantId: 'note_detect' });

    const shims = window.slopsmith.capabilities.snapshotDiagnostics().compatibilityShims;
    assert.equal(shims.find(shim => shim.shimId === 'audio-mix.analyser').hitCount, 1);
    assert.equal(shims.find(shim => shim.shimId === 'audio-input.legacy-source').capability, 'audio-input');
    assert.equal(shims.find(shim => shim.shimId === 'audio-monitoring.audio-barrier').hitCount, 1);
});

// Source-level guards for PR1 runtime compatibility-shim hit accounting.
// Broader app/player/audio domains are reserved for follow-up PRs, so this
// file checks plugin attribution helpers and that library now uses the native
// capability module instead of legacy shim accounting.

const ROOT = path.join(__dirname, '..', '..');
const APP_JS = path.join(ROOT, 'static', 'app.js');
const LIBRARY_JS = path.join(ROOT, 'static', 'capabilities', 'library.js');

function source(file) {
    return fs.readFileSync(file, 'utf8');
}

function region(src, needle, length = 1200) {
    const start = src.indexOf(needle);
    assert.ok(start !== -1, `missing source needle: ${needle}`);
    return src.slice(start, start + length);
}

test('plugin script hydration exposes the current plugin id for legacy registrations', () => {
    const src = source(APP_JS);
    const block = region(src, 'script.src = `/api/plugins/${plugin.id}/screen.js');
    assert.match(block, /window\.slopsmith\._loadingPluginId\s*=\s*plugin\.id/);
    assert.match(block, /delete\s+window\.slopsmith\._loadingPluginId/);
});

test('library providers route through native library capability', () => {
    const src = source(APP_JS);
    const librarySrc = source(LIBRARY_JS);
    const loader = region(src, 'async function loadLibraryProviders', 1800);
    const selector = region(src, 'async function setLibraryProvider(providerId, options = {})', 1600);
    const sync = region(src, 'async function syncLibrarySong(providerId, songId', 1600);

    assert.match(librarySrc, /capabilities\.registerOwner\(['"]library['"]/);
    assert.match(librarySrc, /kind:\s*['"]provider-coordinator['"]/);
    assert.match(librarySrc, /'library\.read': \['query-page', 'query-artists', 'query-stats', 'tuning-names'\]/);
    assert.match(librarySrc, /window\.slopsmith\.libraryProviders\s*=\s*providerApi/);
    assert.match(loader, /api\.refresh\(\{ restoreSaved \}\)/);
    assert.match(selector, /capabilityApi\.command\(['"]library['"],\s*['"]select-provider['"]/);
    assert.match(sync, /capabilityApi\.command\(['"]library['"],\s*['"]sync-song['"]/);
    assert.doesNotMatch(src, /_recordLegacyLibraryProviderShim/);
    assert.doesNotMatch(src, /_recordLegacyLibraryCommand/);
    assert.doesNotMatch(librarySrc, /registerCompatibilityShim|recordLegacyHit/);
});

test('visualization renderer installs preserve plugin attribution', () => {
    const src = source(APP_JS);
    const tagger = region(src, 'function _tagVizRenderer(renderer, id)', 700);
    const setViz = region(src, 'function setViz(id)', 3600);
    const autoViz = region(src, 'function _autoMatchViz()', 5200);

    assert.match(tagger, /renderer\.pluginId\s*=\s*id/);
    assert.match(tagger, /renderer\.source\s*=\s*id/);
    assert.match(setViz, /_installVizRenderer\(renderer,\s*id\)/);
    assert.match(autoViz, /_installVizRenderer\(renderer,\s*id\)/);
});