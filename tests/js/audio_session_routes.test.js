const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadAudioSession, runBrowserScript, installMixerDom } = require('./audio_session_test_harness');

test('audio session records route transitions without blocking callers', () => {
    const window = loadAudioSession();
    const audioSession = window.slopsmith.audioSession;

    const html5 = audioSession.setRoute({ routeKind: 'html5', availability: 'available', selectedByUser: true });
    const stems = audioSession.setRoute({ routeKind: 'stems', availability: 'available', selectedByUser: true });
    const juce = audioSession.setRoute({ routeKind: 'juce', availability: 'degraded', fallbackReason: 'native route unavailable' });
    const snapshot = audioSession.snapshot();

    assert.equal(html5.routeKind, 'html5');
    assert.equal(stems.routeKind, 'stems');
    assert.equal(juce.availability, 'degraded');
    assert.equal(snapshot.domains['audio-mix'].route.routeKind, 'juce');
    assert.equal(snapshot.recentOutcomes.at(-1).outcome, 'degraded');
});

test('legacy song fader registration is bridged into audio-mix participants and route diagnostics', async () => {
    const window = loadAudioSession();
    const { audio } = installMixerDom(window);
    window.localStorage.setItem('volume', '65');

    runBrowserScript(window, 'static/audio-mixer.js');
    assert.equal(typeof window.slopsmith.audio.applySongVolume, 'function');

    await window.slopsmith.audio.applySongVolume(72);
    const snapshot = window.slopsmith.audioSession.snapshot();
    const songParticipant = snapshot.domains['audio-mix'].participants.find(p => p.participantId === 'core.song');

    assert.equal(audio.volume, 0.72);
    assert.equal(songParticipant.label, 'Song');
    assert.equal(songParticipant.fader.currentValue, 72);
    assert.equal(snapshot.domains['audio-mix'].route.routeKind, 'html5');
    assert.equal(snapshot.domains['audio-mix'].bridges.some(b => b.bridgeId === 'audio-mix.song-volume'), true);
});