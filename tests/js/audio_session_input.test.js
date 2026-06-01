const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadAudioSession } = require('./audio_session_test_harness');

test('audio-input registration selection and snapshots pseudonymize source identity', async () => {
    const window = loadAudioSession();
    const api = window.slopsmith.capabilities;

    const registered = await api.dispatch({
        capability: 'audio-input',
        command: 'register-source',
        source: 'note_detect',
        payload: { sourceId: 'device-raw-id-123', providerId: 'note_detect', label: 'Scarlett 2i2 Serial 9876', kind: 'instrument', channelCount: 2 },
    });
    const selected = await api.dispatch({ capability: 'audio-input', command: 'select-source', source: 'note_detect', payload: { sourceId: 'device-raw-id-123' } });
    const missing = await api.dispatch({ capability: 'audio-input', command: 'select-source', source: 'note_detect', payload: { sourceId: 'missing-device' } });

    assert.equal(registered.status, 'applied');
    assert.equal(selected.status, 'applied');
    assert.equal(missing.outcome, 'degraded');
    assert.match(registered.payload.sourceId, /^source-\d+$/);
    assert.match(selected.payload.sourceId, /^source-\d+$/);

    const encoded = JSON.stringify(window.slopsmith.audioSession.snapshot().domains['audio-input']);
    assert.equal(encoded.includes('device-raw-id-123'), false);
    assert.equal(encoded.includes('Scarlett'), false);
});

test('audio-input pseudonyms are per-bundle: distinct within a snapshot, never leak raw identity', () => {
    const window = loadAudioSession();
    const audioSession = window.slopsmith.audioSession;

    audioSession.registerInputSource({ sourceId: 'mic-A', providerId: 'note_detect', label: '/Users/me/My Songs/mic A' });
    audioSession.registerInputSource({ sourceId: 'mic-B', providerId: 'note_detect', label: 'device B' });

    const inputDomain = audioSession.snapshot().domains['audio-input'];
    const pseudonyms = inputDomain.sources.map(source => source.diagnosticsPseudonym);

    // Per-bundle pseudonyms are distinct within one snapshot (spec FR-011/SC-005).
    assert.equal(new Set(pseudonyms).size, pseudonyms.length);
    for (const pseudonym of pseudonyms) assert.match(pseudonym, /^source-\d+$/);

    // Raw source ids/labels never leak into diagnostics.
    const encoded = JSON.stringify(inputDomain);
    assert.equal(encoded.includes('mic-A'), false);
    assert.equal(encoded.includes('/Users/me'), false);
});

test('audio-input degraded select and unknown unregister never leak the raw source id', () => {
    const window = loadAudioSession();
    const audioSession = window.slopsmith.audioSession;

    const degraded = audioSession.selectInputSource('/Users/me/secret-device', 'note_detect');
    const removed = audioSession.unregisterInputSource('/Users/me/secret-device');

    assert.equal(degraded.outcome, 'degraded');
    assert.match(degraded.payload.sourceId, /^source-\d+$/);
    assert.equal(removed.outcome, 'no-handler');
    assert.match(removed.payload.sourceId, /^source-\d+$/);

    const encoded = JSON.stringify({ degraded, removed, snapshot: audioSession.snapshot() });
    assert.equal(encoded.includes('/Users/me'), false);
    assert.equal(encoded.includes('secret-device'), false);
});

test('audio-monitoring distinguishes a failed state from transient unavailability', () => {
    const window = loadAudioSession();
    const audioSession = window.slopsmith.audioSession;

    const failed = audioSession.startMonitoring({ monitoringId: 'mon-failed', state: 'failed', reason: 'JUCE barrier failed' });
    const unavailable = audioSession.startMonitoring({ monitoringId: 'mon-unavail', sourceId: 'missing-device' });

    assert.equal(failed.outcome, 'failed');
    assert.equal(unavailable.outcome, 'degraded');
    assert.equal(unavailable.payload.state, 'unavailable');
});

test('audio-input rejects incompatible and invalid source registrations', async () => {
    const window = loadAudioSession();
    const api = window.slopsmith.capabilities;

    const incompatible = await api.dispatch({ capability: 'audio-input', command: 'register-source', source: 'test', payload: { sourceId: 'mic', version: 99 } });
    const invalid = await api.dispatch({ capability: 'audio-input', command: 'register-source', source: 'test', payload: { providerId: 'test' } });

    assert.equal(incompatible.outcome, 'incompatible-version');
    assert.equal(invalid.outcome, 'failed');
});