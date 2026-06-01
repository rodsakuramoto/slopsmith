const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadAudioSession } = require('./audio_session_test_harness');

test('audio-mix commands inspect register and unregister participants', async () => {
    const window = loadAudioSession();
    const api = window.slopsmith.capabilities;
    const events = [];
    window.slopsmith.on('audio-mix:participant-registered', event => events.push(event.detail.payload.participantId));

    const registered = await api.dispatch({
        capability: 'audio-mix',
        command: 'register-participant',
        source: 'test',
        payload: {
            participantId: 'plugin.delay',
            ownerPluginId: 'delay_plugin',
            label: 'Delay Return',
            kind: 'plugin',
            fader: { id: 'wet', label: 'Wet', min: 0, max: 1, step: 0.01, defaultValue: 0.5, currentValue: 0.6 },
            operations: ['fader.get-value', 'fader.set-value'],
        },
    });
    const inspected = await api.dispatch({ capability: 'audio-mix', command: 'inspect', source: 'test' });
    const removed = await api.dispatch({ capability: 'audio-mix', command: 'unregister-participant', source: 'test', payload: { participantId: 'plugin.delay' } });

    assert.equal(registered.status, 'applied');
    assert.equal(registered.payload.participantId, 'plugin.delay');
    assert.equal(inspected.payload.participants.some(p => p.participantId === 'plugin.delay'), true);
    assert.equal(events.includes('plugin.delay'), true);
    assert.equal(removed.status, 'applied');
    assert.equal(window.slopsmith.audioSession.snapshot().domains['audio-mix'].participants.some(p => p.participantId === 'plugin.delay'), false);
});

test('audio-mix registration reports incompatible participants explicitly', async () => {
    const window = loadAudioSession();
    const result = await window.slopsmith.capabilities.dispatch({
        capability: 'audio-mix',
        command: 'register-participant',
        source: 'test',
        payload: { participantId: 'future.plugin', version: 2 },
    });

    assert.equal(result.status, 'incompatible-version');
    assert.equal(result.outcome, 'incompatible-version');
    assert.equal(window.slopsmith.audioSession.snapshot().recentOutcomes.at(-1).outcome, 'incompatible-version');
});