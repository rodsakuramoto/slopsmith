const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadAudioSession } = require('./audio_session_test_harness');

test('audio-monitoring records active denied unavailable and stopped states', async () => {
    const window = loadAudioSession();
    const api = window.slopsmith.capabilities;

    const active = await api.dispatch({ capability: 'audio-monitoring', command: 'start', source: 'note_detect', payload: { monitoringId: 'mon-a', state: 'active' } });
    const denied = await api.dispatch({ capability: 'audio-monitoring', command: 'start', source: 'note_detect', payload: { monitoringId: 'mon-b', state: 'denied', reason: 'permission denied' } });
    const unavailable = await api.dispatch({ capability: 'audio-monitoring', command: 'start', source: 'note_detect', payload: { monitoringId: 'mon-c', sourceId: 'missing-device' } });
    const stopped = await api.dispatch({ capability: 'audio-monitoring', command: 'stop', source: 'note_detect', payload: { monitoringId: 'mon-a' } });
    const failedStop = await api.dispatch({ capability: 'audio-monitoring', command: 'stop', source: 'note_detect', payload: { monitoringId: 'missing-monitor' } });

    assert.equal(active.status, 'applied');
    assert.equal(denied.outcome, 'denied');
    assert.equal(unavailable.outcome, 'degraded');
    assert.equal(unavailable.payload.state, 'unavailable');
    assert.equal(stopped.status, 'applied');
    assert.equal(failedStop.outcome, 'no-handler');

    const outcomes = window.slopsmith.audioSession.snapshot().recentOutcomes.filter(entry => entry.domain === 'audio-monitoring');
    assert.equal(outcomes.some(entry => entry.outcome === 'denied' && entry.status === 'denied'), true);
    assert.equal(outcomes.some(entry => entry.outcome === 'degraded' && entry.status === 'unavailable'), true);
    assert.equal(outcomes.some(entry => entry.outcome === 'no-handler'), true);
});

test('audio-session diagnostics remain bounded during frequent input monitoring updates', () => {
    const window = loadAudioSession();
    const audioSession = window.slopsmith.audioSession;
    for (let index = 0; index < 500; index += 1) {
        audioSession.registerInputSource({ sourceId: `source-${index}`, providerId: 'bench', label: `/Users/example/private-${index}` });
        audioSession.startMonitoring({ monitoringId: `mon-${index}`, sourceId: `source-${index}` });
    }
    const snapshot = audioSession.snapshot();
    const encoded = JSON.stringify(snapshot);
    assert.equal(snapshot.recentOutcomes.length <= 100, true);
    assert.equal(encoded.length < 64 * 1024, true);
    assert.equal(encoded.includes('/Users/example'), false);
});