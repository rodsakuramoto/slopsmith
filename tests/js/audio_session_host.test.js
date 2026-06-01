const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadAudioSession } = require('./audio_session_test_harness');

test('audio session host registers active core domains and contributes diagnostics', () => {
    const window = loadAudioSession();
    const api = window.slopsmith.capabilities;
    const diagnostics = window.slopsmith.diagnostics.snapshotContributions();

    for (const domain of ['audio-mix', 'audio-input', 'audio-monitoring']) {
        const pipeline = api.inspect(domain);
        assert.equal(pipeline.review.lifecycle, 'active');
        assert.equal(pipeline.participants.some(p => p.pluginId === 'core.audio.session' && p.roles.includes('owner')), true);
    }
    const stemsPipeline = api.inspect('stems');
    assert.equal(stemsPipeline.review.lifecycle, 'active');
    assert.equal(stemsPipeline.participants.some(p => p.pluginId === 'core.audio.session' && p.roles.includes('coordinator') && !p.roles.includes('owner')), true);
    assert.equal(diagnostics['audio-session'].schema, 'slopsmith.audio_session.diagnostics.v1');
});

test('audio session lifecycle and snapshots redact source identity with per-snapshot pseudonyms', () => {
    const window = loadAudioSession();
    const audioSession = window.slopsmith.audioSession;

    audioSession.startSession({ sessionId: 'main:/Users/example/DLC/song.psarc', songKey: '/Users/example/DLC/song.psarc', songFormat: 'psarc' });
    audioSession.setRoute({ routeKind: 'html5', availability: 'available', deviceLabel: 'Scarlett 2i2 Serial 1234' });
    audioSession.registerInputSource({ sourceId: 'mic-raw-id', providerId: 'browser', kind: 'instrument', channelCount: 2, availability: 'available', label: 'Scarlett 2i2 Serial 1234' });

    const snapshot = audioSession.snapshot();
    const encoded = JSON.stringify(snapshot);
    assert.equal(snapshot.session.songFormat, 'psarc');
    assert.match(snapshot.domains['audio-input'].sources[0].diagnosticsPseudonym, /^source-\d{2}$/);
    assert.equal(encoded.includes('Scarlett'), false);
    assert.equal(encoded.includes('/Users/example'), false);
});

test('audio diagnostics record bounded runtime outcomes and domain statuses', () => {
    const window = loadAudioSession();
    const audioSession = window.slopsmith.audioSession;

    for (let i = 0; i < 120; i += 1) {
        audioSession.recordOutcome({ domain: 'audio-input', operation: 'select-source', participantId: 'test', outcome: 'degraded', status: 'unavailable', reason: `missing-${i}` });
    }

    const snapshot = audioSession.snapshot();
    assert.equal(snapshot.recentOutcomes.length, 100);
    assert.equal(snapshot.recentOutcomes.at(-1).status, 'unavailable');
    assert.equal(snapshot.recentOutcomes.at(-1).outcome, 'degraded');
});

test('disabled missing incompatible unsupported and timeout paths are diagnosable', async () => {
    const window = loadAudioSession();
    const api = window.slopsmith.capabilities;
    const audioSession = window.slopsmith.audioSession;

    audioSession.registerMixParticipant({ participantId: 'disabled-fader', availability: 'disabled' });
    assert.equal(audioSession.snapshot().domains['audio-mix'].participants[0].availability, 'disabled');

    const missingOwner = await api.dispatch({ capability: 'stems', command: 'inspect', source: 'test' });
    assert.equal(missingOwner.outcome, 'no-owner');

    const incompatible = await api.dispatch({ capability: 'audio-mix', command: 'register-participant', source: 'test', payload: { participantId: 'bad', version: 2 } });
    assert.equal(incompatible.outcome, 'incompatible-version');

    const unsupported = await api.dispatch({ capability: 'audio-mix', command: 'not-a-command', source: 'test' });
    assert.equal(unsupported.outcome, 'unsupported-command');

    api.registerParticipant('slow_audio_probe', {
        'audio-mix': {
            roles: ['provider'],
            commands: ['slow-probe'],
            runtime: true,
            handlers: { 'slow-probe': () => new Promise(resolve => setTimeout(() => resolve({ outcome: 'handled' }), 20)) },
        },
    });
    const timedOut = await api.command('audio-mix', 'slow-probe', { requester: 'test', timeoutMs: 1 });
    assert.equal(timedOut.outcome, 'failed');
    assert.match(timedOut.reason, /timed out/i);
});