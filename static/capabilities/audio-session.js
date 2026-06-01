// Core audio graph/session capability domain host.
(function () {
    'use strict';

    window.slopsmith = window.slopsmith || {};
    const capabilities = window.slopsmith.capabilities;
    if (!capabilities || capabilities.version !== 1) return;
    if (window.slopsmith.audioSession && window.slopsmith.audioSession.version === 1) return;

    const SCHEMA = 'slopsmith.audio_session.diagnostics.v1';
    const DOMAINS = Object.freeze(['audio-mix', 'audio-input', 'audio-monitoring', 'stems']);
    const MAX_OUTCOMES = 100;
    const MAX_DOMAIN_ITEMS = 50;
    const OWNER_ID = 'core.audio.session';

    let sequence = 0;
    let currentSession = _newSession({});

    function _now() { return new Date().toISOString(); }

    function _id(prefix) {
        sequence += 1;
        return `${prefix}-${sequence}`;
    }

    function _string(value, fallback = '') {
        const normalized = String(value == null ? '' : value).trim();
        return normalized || fallback;
    }

    function _number(value, fallback = null) {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : fallback;
    }

    function _strings(value) {
        return Array.isArray(value) ? value.map(item => _string(item)).filter(Boolean) : [];
    }

    function _plainObject(value) {
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }

    function _redactString(value) {
        // Redact absolute paths (macOS, Linux/Docker home & root, Windows). Spaces
        // are allowed because song files/paths routinely contain them, but matching
        // stops at line breaks, tabs, and structural delimiters so unrelated trailing
        // diagnostic text on the same line is preserved rather than over-redacted.
        const tail = `[^\\r\\n\\t"'\`,;(){}\\[\\]<>|]*`;
        const path = new RegExp(`(?:/Users/|/home/|/root\\b/?|[A-Za-z]:\\\\)${tail}`, 'g');
        return _string(value)
            .replace(path, '[path]')
            .replace(/\b(token|secret|password|api[_-]?key)=([^\s&]+)/gi, '$1=[redacted]');
    }

    function _boundedReason(value) {
        return _redactString(value).replace(/\s+/g, ' ').slice(0, 240);
    }

    function _clone(value) {
        if (value == null || typeof value !== 'object') return value;
        try { return JSON.parse(JSON.stringify(value)); }
        catch (_) { return null; }
    }

    function _newSession(options) {
        const source = _plainObject(options);
        return {
            sessionId: _string(source.sessionId, 'main:idle'),
            playerId: _string(source.playerId, 'main'),
            songKey: _string(source.songKey, ''),
            songFormat: _string(source.songFormat, 'unknown'),
            state: _string(source.state, 'initializing'),
            routeState: _normalizeRoute(source.routeState || source.route || {}),
            mixParticipants: new Map(),
            inputSources: new Map(),
            monitoringSessions: new Map(),
            stemOwner: null,
            stemClaims: new Map(),
            bridges: new Map(),
            outcomes: [],
            createdAt: _now(),
            updatedAt: _now(),
        };
    }

    function _touch() {
        currentSession.updatedAt = _now();
        _contributeDiagnostics();
    }

    function _normalizeRoute(route) {
        const source = _plainObject(route);
        return {
            routeId: _string(source.routeId || source.id, 'route:unknown'),
            routeKind: _string(source.routeKind || source.kind, 'unknown'),
            availability: _string(source.availability, 'unknown'),
            selectedByUser: source.selectedByUser === true,
            devicePseudonym: _string(source.devicePseudonym || source.deviceId || source.deviceLabel, ''),
            fallbackReason: _boundedReason(source.fallbackReason || source.reason),
        };
    }

    function _normalizeFader(fader) {
        const source = _plainObject(fader);
        if (!Object.keys(source).length) return null;
        const min = _number(source.min, 0);
        const max = _number(source.max, 1);
        const step = _number(source.step, 0.01);
        return {
            id: _string(source.id, 'main'),
            label: _string(source.label, 'Volume'),
            unit: _string(source.unit, ''),
            min,
            max: max > min ? max : min + 1,
            step: step > 0 ? step : 0.01,
            defaultValue: _number(source.defaultValue, min),
            currentValue: _number(source.currentValue, _number(source.value, _number(source.defaultValue, min))),
        };
    }

    function _normalizeParticipant(spec) {
        const source = _plainObject(spec);
        const participantId = _string(source.participantId || source.id);
        if (!participantId) return null;
        return {
            participantId,
            ownerPluginId: _string(source.ownerPluginId || source.pluginId || source.source, 'core'),
            label: _string(source.label || source.name, participantId),
            kind: _string(source.kind, 'other'),
            fader: _normalizeFader(source.fader),
            operations: _strings(source.operations || source.providerOperations),
            availability: _string(source.availability, source.disabled ? 'disabled' : 'available'),
            compatibilitySource: _string(source.compatibilitySource || source.legacySurface, ''),
        };
    }

    function _normalizeSource(spec) {
        const source = _plainObject(spec);
        const sourceId = _string(source.sourceId || source.id);
        if (!sourceId) return null;
        return {
            sourceId,
            providerId: _string(source.providerId || source.participantId, 'core.audio.input'),
            kind: _string(source.kind, 'unknown'),
            channelCount: _number(source.channelCount, null),
            availability: _string(source.availability, 'unknown'),
            selected: source.selected === true,
            diagnosticsPseudonym: _string(source.diagnosticsPseudonym || source.deviceId || source.label || source.name || sourceId, sourceId),
        };
    }

    function _recordOutcome(entry) {
        const source = _plainObject(entry);
        const outcome = _string(source.outcome, 'handled');
        const record = {
            domain: DOMAINS.includes(source.domain) ? source.domain : 'audio-mix',
            operation: _string(source.operation || source.command || source.event, 'inspect'),
            participantId: _string(source.participantId || source.ownerId || source.requester, ''),
            bridgeId: _string(source.bridgeId, ''),
            outcome,
            status: _string(source.status, ''),
            reason: _boundedReason(source.reason),
            timestamp: _string(source.timestamp, _now()),
        };
        currentSession.outcomes.push(record);
        while (currentSession.outcomes.length > MAX_OUTCOMES) currentSession.outcomes.shift();
        currentSession.updatedAt = _now();
        return record;
    }

    function _handled(payload) { return { outcome: 'handled', payload }; }
    function _degraded(reason, payload) { return { outcome: 'degraded', reason, payload }; }
    function _failed(reason, payload) { return { outcome: 'failed', reason, payload }; }
    function _noHandler(reason, payload) { return { outcome: 'no-handler', reason, payload }; }
    function _noOwner(reason, payload) { return { outcome: 'no-owner', reason, payload }; }
    function _incompatible(reason, payload) { return { outcome: 'incompatible-version', reason, payload }; }

    function startSession(options = {}) {
        currentSession = _newSession({ ...options, state: 'active' });
        _recordOutcome({ domain: 'audio-mix', operation: 'session.start', participantId: OWNER_ID, outcome: 'handled' });
        _touch();
        return snapshot();
    }

    function stopSession(reason = 'Session stopped') {
        currentSession.state = 'stopped';
        _recordOutcome({ domain: 'audio-mix', operation: 'session.stop', participantId: OWNER_ID, outcome: 'handled', reason });
        _touch();
        return snapshot();
    }

    function setRoute(route) {
        currentSession.routeState = _normalizeRoute(route);
        const degraded = currentSession.routeState.availability === 'degraded' || currentSession.routeState.availability === 'unavailable';
        _recordOutcome({
            domain: 'audio-mix',
            operation: 'route.set',
            participantId: OWNER_ID,
            outcome: degraded ? 'degraded' : 'handled',
            status: currentSession.routeState.availability,
            reason: currentSession.routeState.fallbackReason,
        });
        // Redact the device identity before it reaches event subscribers or the
        // caller; raw deviceLabel/deviceId only ever live in currentSession.
        // Snapshot the return clone before dispatching the (mutable) event payload
        // so a subscriber can't desync or mutate the caller's copy.
        const redactedRoute = _redactedRoute(currentSession.routeState, _newPseudonymizer());
        const returnedRoute = _clone(redactedRoute);
        capabilities.emitEvent('audio-mix', degraded ? 'route-degraded' : 'route-changed', redactedRoute);
        _touch();
        return returnedRoute;
    }

    function registerMixParticipant(spec) {
        const source = _plainObject(spec);
        if (source.incompatible || (source.version && Number(source.version) !== 1)) {
            const result = _incompatible('Mix participant requires audio-session contract version 1');
            _recordOutcome({ domain: 'audio-mix', operation: 'register-participant', participantId: source.participantId || source.id, outcome: result.outcome, reason: result.reason });
            return result;
        }
        const participant = _normalizeParticipant(source);
        if (!participant) {
            const result = _failed('Mix participant registration requires participantId');
            _recordOutcome({ domain: 'audio-mix', operation: 'register-participant', outcome: result.outcome, reason: result.reason });
            return result;
        }
        currentSession.mixParticipants.set(participant.participantId, participant);
        _recordOutcome({ domain: 'audio-mix', operation: 'register-participant', participantId: participant.participantId, outcome: 'handled', status: participant.availability });
        // Emit a clone so a subscriber can't mutate the stored session state.
        capabilities.emitEvent('audio-mix', 'participant-registered', _clone(participant));
        _touch();
        return _handled(_clone(participant));
    }

    function unregisterMixParticipant(participantId) {
        const id = _string(participantId);
        const removed = currentSession.mixParticipants.delete(id);
        const outcome = removed ? 'handled' : 'no-handler';
        _recordOutcome({ domain: 'audio-mix', operation: 'unregister-participant', participantId: id, outcome });
        if (removed) capabilities.emitEvent('audio-mix', 'participant-removed', { participantId: id });
        _touch();
        return removed ? _handled({ participantId: id, removed: true }) : _noHandler(`Unknown mix participant: ${id}`, { participantId: id, removed: false });
    }

    function registerInputSource(spec) {
        const source = _plainObject(spec);
        if (source.incompatible || (source.version && Number(source.version) !== 1)) {
            const result = _incompatible('Input source requires audio-session contract version 1');
            _recordOutcome({ domain: 'audio-input', operation: 'register-source', participantId: source.providerId, outcome: result.outcome, reason: result.reason });
            return result;
        }
        const input = _normalizeSource(source);
        if (!input) {
            const result = _failed('Input source registration requires sourceId');
            _recordOutcome({ domain: 'audio-input', operation: 'register-source', outcome: result.outcome, reason: result.reason });
            return result;
        }
        currentSession.inputSources.set(input.sourceId, input);
        _recordOutcome({ domain: 'audio-input', operation: 'register-source', participantId: input.providerId, outcome: 'handled', status: input.availability });
        // Per-bundle pseudonym (spec FR-011/SC-005: not stable across exports). One
        // pseudonymizer per call so the event and return agree within this call;
        // clone the return before dispatching the (mutable) event payload so a
        // subscriber can't alter the caller's copy.
        const pseudonymize = _newPseudonymizer();
        const redacted = _redactedSource(input, pseudonymize);
        const returned = _clone(redacted);
        capabilities.emitEvent('audio-input', 'source-registered', redacted);
        _touch();
        return _handled(returned);
    }

    function unregisterInputSource(sourceId) {
        const id = _string(sourceId);
        const existing = currentSession.inputSources.get(id);
        // The accumulated outcome record is attributed to the domain (not a source
        // pseudonym) so recentOutcomes never carries the raw id and distinct
        // removals don't collapse to the same per-bundle pseudonym within a
        // snapshot. The per-call pseudonym below is only for the ephemeral event
        // and return payloads (per-bundle, not stable across exports per spec).
        const pseudonymize = _newPseudonymizer();
        if (!existing) {
            const pseudonym = pseudonymize(id, 'source');
            _recordOutcome({ domain: 'audio-input', operation: 'unregister-source', participantId: 'core.audio.input', outcome: 'no-handler' });
            _touch();
            return _noHandler('Unknown input source', { sourceId: pseudonym, removed: false });
        }
        const pseudonym = pseudonymize(existing.sourceId, 'source');
        currentSession.inputSources.delete(id);
        _recordOutcome({ domain: 'audio-input', operation: 'unregister-source', participantId: 'core.audio.input', outcome: 'handled' });
        capabilities.emitEvent('audio-input', 'source-removed', { sourceId: pseudonym });
        _touch();
        return _handled({ sourceId: pseudonym, removed: true });
    }

    function selectInputSource(sourceId, requester = 'unknown') {
        const id = _string(sourceId);
        const selected = currentSession.inputSources.get(id);
        if (!selected) {
            // Pseudonymize the missing id and keep it out of the reason string so the
            // raw device id never reaches recentOutcomes / diagnostics bundles.
            const pseudonym = _newPseudonymizer()(id, 'source');
            const result = _degraded('Input source is unavailable', { sourceId: pseudonym, availability: 'unavailable' });
            _recordOutcome({ domain: 'audio-input', operation: 'select-source', participantId: requester, outcome: result.outcome, status: 'unavailable', reason: result.reason });
            return result;
        }
        for (const source of currentSession.inputSources.values()) source.selected = source.sourceId === id;
        _recordOutcome({ domain: 'audio-input', operation: 'select-source', participantId: requester, outcome: 'handled', status: selected.availability });
        // Per-bundle pseudonym: one pseudonymizer per call shared by the event and
        // the return; the return is a separate redacted clone so a subscriber can't
        // mutate it.
        const pseudonymize = _newPseudonymizer();
        const eventSourceId = pseudonymize(selected.sourceId, 'source');
        const returned = _clone(_redactedSource(selected, pseudonymize));
        capabilities.emitEvent('audio-input', 'source-selected', { sourceId: eventSourceId, requester });
        _touch();
        return _handled(returned);
    }

    function startMonitoring(spec = {}) {
        const source = _plainObject(spec);
        const monitoringId = _string(source.monitoringId || source.id, _id('monitoring'));
        const sourceId = _string(source.sourceId, '');
        const knownSource = sourceId ? currentSession.inputSources.get(sourceId) : null;
        const requestedState = _string(source.state, knownSource || !sourceId ? 'active' : 'unavailable');
        const session = {
            monitoringId,
            participantId: _string(source.participantId || source.providerId || source.requester, 'core.audio.monitoring'),
            sourceId,
            state: requestedState,
            startedAt: requestedState === 'active' ? _now() : null,
            stoppedAt: null,
            failureReason: _boundedReason(source.failureReason || source.reason),
        };
        currentSession.monitoringSessions.set(monitoringId, session);
        // Distinguish a real failure (e.g. JUCE barrier failure) from transient
        // unavailability so diagnostics don't conflate them.
        let outcome = 'degraded';
        if (requestedState === 'active') outcome = 'handled';
        else if (requestedState === 'denied') outcome = 'denied';
        else if (requestedState === 'failed') outcome = 'failed';
        _recordOutcome({ domain: 'audio-monitoring', operation: 'start', participantId: session.participantId, outcome, status: session.state, reason: session.failureReason });
        // Per-bundle pseudonym; redact once, snapshot an independent clone for the
        // caller before dispatching the (mutable) event payload.
        const pseudonymize = _newPseudonymizer();
        const redactedSession = _redactedMonitoringSession(session, pseudonymize);
        const returnedSession = _clone(redactedSession);
        let eventName = 'monitoring-unavailable';
        if (requestedState === 'active') eventName = 'monitoring-started';
        else if (outcome === 'failed') eventName = 'monitoring-failed';
        capabilities.emitEvent('audio-monitoring', eventName, redactedSession);
        _touch();
        if (outcome === 'handled') return _handled(returnedSession);
        if (outcome === 'denied') return { outcome: 'denied', reason: session.failureReason || `Monitoring state: ${session.state}`, payload: returnedSession };
        if (outcome === 'failed') return _failed(session.failureReason || `Monitoring state: ${session.state}`, returnedSession);
        return _degraded(session.failureReason || `Monitoring state: ${session.state}`, returnedSession);
    }

    function stopMonitoring(monitoringId, requester = 'unknown') {
        const id = _string(monitoringId);
        const session = currentSession.monitoringSessions.get(id);
        if (!session) {
            const result = _noHandler(`Unknown monitoring session: ${id}`, { monitoringId: id });
            _recordOutcome({ domain: 'audio-monitoring', operation: 'stop', participantId: requester, outcome: result.outcome, reason: result.reason });
            return result;
        }
        session.state = 'stopped';
        session.stoppedAt = _now();
        _recordOutcome({ domain: 'audio-monitoring', operation: 'stop', participantId: requester, outcome: 'handled', status: 'stopped' });
        // Per-bundle pseudonym; redact once, snapshot an independent clone for the
        // caller before dispatching the (mutable) event payload.
        const redactedSession = _redactedMonitoringSession(session, _newPseudonymizer());
        const returnedSession = _clone(redactedSession);
        capabilities.emitEvent('audio-monitoring', 'monitoring-stopped', redactedSession);
        _touch();
        return _handled(returnedSession);
    }

    function registerStemOwner(owner) {
        const source = _plainObject(owner);
        const previousOwnerId = currentSession.stemOwner ? currentSession.stemOwner.ownerId : '';
        if (currentSession.stemOwner && source.availability && source.availability !== 'available') {
            for (const claim of currentSession.stemClaims.values()) {
                if (claim.state === 'active') {
                    claim.state = 'orphaned';
                    claim.updatedAt = _now();
                    capabilities.emitEvent('stems', 'claim-orphaned', _clone(claim));
                }
            }
        }
        currentSession.stemOwner = {
            ownerId: _string(source.ownerId || source.participantId || source.id, 'stems'),
            stemIds: _strings(source.stemIds),
            stemStates: _clone(source.stemStates || {}) || {},
            availability: _string(source.availability, 'available'),
        };
        // When the provider identity changes, retire the prior provider participant
        // so the stems pipeline/diagnostics don't keep a stale active provider.
        // Never retire the audio-session coordinator (OWNER_ID) itself.
        if (previousOwnerId && previousOwnerId !== currentSession.stemOwner.ownerId && previousOwnerId !== OWNER_ID && typeof capabilities.unregisterParticipant === 'function') {
            capabilities.unregisterParticipant(previousOwnerId, 'stems');
        }
        if (typeof capabilities.registerParticipant === 'function') {
            capabilities.registerParticipant(currentSession.stemOwner.ownerId, {
                stems: {
                    roles: ['provider'],
                    operations: ['stem.get-state', 'stem.apply-automation', 'stem.restore-automation'],
                    events: ['owner-available', 'owner-unavailable'],
                    kind: 'provider-coordinator',
                    mode: currentSession.stemOwner.availability === 'available' ? 'active' : 'disabled',
                    compatibility: 'none',
                    ownership: 'multi-provider',
                    safety: 'safe',
                    runtime: true,
                    version: 1,
                    description: 'Active Stems provider registered behind the audio-session coordinator.',
                },
            });
        }
        _recordOutcome({ domain: 'stems', operation: 'owner.register', participantId: currentSession.stemOwner.ownerId, outcome: 'handled', status: currentSession.stemOwner.availability });
        const ownerEvent = currentSession.stemOwner.availability === 'available' ? 'owner-available' : 'owner-unavailable';
        capabilities.emitEvent('stems', ownerEvent, _clone(currentSession.stemOwner));
        _touch();
        return _handled(_clone(currentSession.stemOwner));
    }

    function _pruneStemClaims() {
        // Bound claim growth for long-running/buggy sessions so snapshots and
        // diagnostics bundles stay small. Drop the oldest terminal-state claims
        // first (Map preserves insertion order); never drop an active claim.
        if (currentSession.stemClaims.size <= MAX_DOMAIN_ITEMS) return;
        for (const [claimId, claim] of currentSession.stemClaims) {
            if (currentSession.stemClaims.size <= MAX_DOMAIN_ITEMS) break;
            if (claim.state !== 'active') currentSession.stemClaims.delete(claimId);
        }
    }

    function muteStems(spec = {}) {
        if (!currentSession.stemOwner || currentSession.stemOwner.availability !== 'available') {
            const result = _noOwner('No active stem owner is available');
            _recordOutcome({ domain: 'stems', operation: 'mute', participantId: _string(spec.requester, ''), outcome: result.outcome, status: currentSession.stemOwner ? currentSession.stemOwner.availability : 'no-owner', reason: result.reason });
            return result;
        }
        const source = _plainObject(spec);
        const claimId = _string(source.claimId, _id('stem-claim'));
        const claim = {
            claimId,
            requesterId: _string(source.requester || source.requesterId, 'unknown'),
            targetStemIds: _strings(source.stemIds || source.targetStemIds),
            requestedAction: _string(source.action || source.requestedAction, 'mute'),
            restoreSnapshot: _clone(source.restoreSnapshot || currentSession.stemOwner.stemStates) || {},
            state: 'active',
            createdAt: _now(),
            updatedAt: _now(),
        };
        currentSession.stemClaims.set(claimId, claim);
        _pruneStemClaims();
        capabilities.claim({ capability: 'stems', claimId, requester: claim.requesterId, owner: currentSession.stemOwner.ownerId, target: { stemIds: claim.targetStemIds } });
        _recordOutcome({ domain: 'stems', operation: 'mute', participantId: claim.requesterId, outcome: 'handled' });
        capabilities.emitEvent('stems', 'automation-applied', _clone(claim));
        _touch();
        return _handled(_clone(claim));
    }

    function restoreStems(spec = {}) {
        const source = _plainObject(spec);
        const claimId = _string(source.claimId || source.id);
        const claim = currentSession.stemClaims.get(claimId);
        if (!claim) {
            const result = _noHandler(`Unknown stem automation claim: ${claimId}`);
            _recordOutcome({ domain: 'stems', operation: 'restore', participantId: source.requester, outcome: result.outcome, reason: result.reason });
            return result;
        }
        claim.state = source.overridden || claim.state === 'overridden' ? 'overridden' : 'restored';
        claim.updatedAt = _now();
        capabilities.release({ capability: 'stems', claimId, requester: source.requester || claim.requesterId });
        _recordOutcome({ domain: 'stems', operation: 'restore', participantId: source.requester || claim.requesterId, outcome: claim.state === 'overridden' ? 'overridden' : 'handled' });
        capabilities.emitEvent('stems', claim.state === 'overridden' ? 'automation-overridden' : 'automation-restored', _clone(claim));
        _touch();
        return claim.state === 'overridden' ? { outcome: 'overridden', payload: _clone(claim) } : _handled(_clone(claim));
    }

    function recordStemManualOverride(override = {}) {
        const source = _plainObject(override);
        const targets = _strings(source.stemIds || source.targetStemIds);
        const overriddenClaims = [];
        for (const claim of currentSession.stemClaims.values()) {
            if (claim.state !== 'active') continue;
            const claimTargets = Array.isArray(claim.targetStemIds) ? claim.targetStemIds : [];
            const matches = !targets.length || !claimTargets.length || claimTargets.some(stemId => targets.includes(stemId));
            if (!matches) continue;
            claim.state = 'overridden';
            claim.updatedAt = _now();
            overriddenClaims.push(_clone(claim));
            capabilities.emitEvent('stems', 'automation-overridden', _clone(claim));
        }
        if (typeof capabilities.recordUserOverride === 'function') {
            capabilities.recordUserOverride({ capability: 'stems', source: source.requester || 'user', target: { stemIds: targets }, reason: source.reason || 'Manual stem choice overrode automation' });
        }
        _recordOutcome({ domain: 'stems', operation: 'manual-override', participantId: source.requester || 'user', outcome: overriddenClaims.length ? 'overridden' : 'handled', status: overriddenClaims.length ? 'overridden' : 'no-active-claim', reason: source.reason });
        _touch();
        return { overriddenClaims };
    }

    function recordBridgeHit(bridge = {}) {
        const source = _plainObject(bridge);
        const domain = DOMAINS.includes(source.domain) ? source.domain : _string(source.capability, 'audio-mix');
        const bridgeId = _string(source.bridgeId || source.shimId, `${domain}.${_string(source.legacySurface, 'legacy')}`);
        const entry = {
            bridgeId,
            legacySurface: _string(source.legacySurface, 'unknown'),
            domain,
            participantId: _string(source.participantId || source.source || source.requester, 'legacy-runtime'),
            outcome: _string(source.outcome, 'handled'),
            status: _string(source.status, 'used'),
            reason: _boundedReason(source.reason),
            hitCount: (currentSession.bridges.get(bridgeId)?.hitCount || 0) + 1,
            lastHitAt: _now(),
        };
        currentSession.bridges.set(bridgeId, entry);
        if (typeof capabilities.recordLegacyHit === 'function') {
            capabilities.recordLegacyHit({ capability: domain, legacySurface: entry.legacySurface, source: entry.participantId, reason: entry.reason, shimId: bridgeId });
        }
        _recordOutcome({ domain, operation: 'bridge-hit', participantId: entry.participantId, bridgeId, outcome: entry.outcome, status: entry.status, reason: entry.reason });
        capabilities.emitEvent(domain, 'bridge-hit', _clone(entry));
        _touch();
        return _clone(entry);
    }

    function _newPseudonymizer() {
        const seen = new Map();
        let count = 0;
        return function pseudonym(value, prefix = 'source') {
            const key = `${prefix}:${_string(value, prefix)}`;
            if (!seen.has(key)) {
                count += 1;
                seen.set(key, `${prefix}-${String(count).padStart(2, '0')}`);
            }
            return seen.get(key);
        };
    }

    function _redactedSource(source, pseudonymize) {
        // Per-bundle pseudonym (spec FR-011/SC-005: scoped to one export, not stable
        // across exports). Keyed off the unique sourceId — used only as an internal
        // pseudonymizer key, never exposed — so distinct sources stay distinct even
        // when they share a device label, and monitoring (also keyed off sourceId)
        // correlates within the bundle.
        const sourcePseudonym = pseudonymize(source.sourceId, 'source');
        return {
            sourceId: sourcePseudonym,
            providerId: source.providerId,
            kind: source.kind,
            channelCount: source.channelCount,
            availability: source.availability,
            selected: !!source.selected,
            diagnosticsPseudonym: sourcePseudonym,
        };
    }

    function _redactedRoute(route, pseudonymize) {
        return {
            ...route,
            devicePseudonym: route.devicePseudonym ? pseudonymize(route.devicePseudonym, 'device') : '',
        };
    }

    function _redactedMonitoringSession(session, pseudonymize) {
        const clone = _clone(session) || {};
        if (clone.sourceId) {
            // Per-bundle pseudonym keyed off the sourceId, which equals the input
            // source's key when known, so monitoring correlates with audio-input
            // within one bundle without exposing the raw (device-id/path-like) id.
            clone.sourceId = pseudonymize(clone.sourceId, 'source');
        }
        return clone;
    }

    function _domainBridges(domain) {
        return Array.from(currentSession.bridges.values()).filter(bridge => bridge.domain === domain).map(_clone);
    }

    function snapshot() {
        // One per-bundle pseudonymizer for the whole snapshot: sources correlate
        // within this export but pseudonyms are not stable across exports.
        const pseudonymize = _newPseudonymizer();
        const inputSources = Array.from(currentSession.inputSources.values()).slice(-MAX_DOMAIN_ITEMS);
        const monitoringSessions = Array.from(currentSession.monitoringSessions.values()).slice(-MAX_DOMAIN_ITEMS);
        return {
            schema: SCHEMA,
            session: {
                sessionId: _redactString(currentSession.sessionId),
                playerId: currentSession.playerId,
                songKey: currentSession.songKey ? pseudonymize(currentSession.songKey, 'song') : '',
                songFormat: currentSession.songFormat,
                state: currentSession.state,
                route: _redactedRoute(currentSession.routeState, pseudonymize),
                createdAt: currentSession.createdAt,
                updatedAt: currentSession.updatedAt,
            },
            domains: {
                'audio-mix': {
                    participants: Array.from(currentSession.mixParticipants.values()).map(_clone),
                    route: _redactedRoute(currentSession.routeState, pseudonymize),
                    bridges: _domainBridges('audio-mix'),
                },
                'audio-input': {
                    sources: inputSources.map(source => _redactedSource(source, pseudonymize)),
                    totalSources: currentSession.inputSources.size,
                    bridges: _domainBridges('audio-input'),
                },
                'audio-monitoring': {
                    sessions: monitoringSessions.map(session => _redactedMonitoringSession(session, pseudonymize)),
                    totalSessions: currentSession.monitoringSessions.size,
                    bridges: _domainBridges('audio-monitoring'),
                },
                stems: {
                    owner: _clone(currentSession.stemOwner),
                    claims: Array.from(currentSession.stemClaims.values()).map(_clone),
                    bridges: _domainBridges('stems'),
                },
            },
            recentOutcomes: currentSession.outcomes.slice(),
        };
    }

    function _payload(ctx) {
        return _plainObject(ctx && ctx.payload);
    }

    function _target(ctx) {
        const target = _plainObject(ctx && ctx.target);
        return { ..._payload(ctx), ...target };
    }

    function _audioMixCommand(commandName, ctx = {}) {
        const payload = _target(ctx);
        if (commandName === 'inspect') return _handled(snapshot().domains['audio-mix']);
        if (commandName === 'register-participant') return registerMixParticipant(payload);
        if (commandName === 'unregister-participant') return unregisterMixParticipant(payload.participantId || payload.id);
        return _degraded(`Unsupported audio-mix command: ${commandName}`);
    }

    function _audioInputCommand(commandName, ctx = {}) {
        const payload = _target(ctx);
        if (commandName === 'inspect') return _handled(snapshot().domains['audio-input']);
        if (commandName === 'register-source') return registerInputSource(payload);
        if (commandName === 'unregister-source') return unregisterInputSource(payload.sourceId || payload.id);
        if (commandName === 'select-source') return selectInputSource(payload.sourceId || payload.id, ctx.requester);
        return _degraded(`Unsupported audio-input command: ${commandName}`);
    }

    function _audioMonitoringCommand(commandName, ctx = {}) {
        const payload = _target(ctx);
        if (commandName === 'inspect') return _handled(snapshot().domains['audio-monitoring']);
        if (commandName === 'start') return startMonitoring({ ...payload, requester: ctx.requester });
        if (commandName === 'stop') return stopMonitoring(payload.monitoringId || payload.id, ctx.requester);
        return _degraded(`Unsupported audio-monitoring command: ${commandName}`);
    }

    function _stemsCommand(commandName, ctx = {}) {
        const payload = _target(ctx);
        if (commandName === 'inspect') {
            const stems = snapshot().domains.stems;
            return stems.owner ? _handled(stems) : _noOwner('No active stem owner is available', stems);
        }
        if (commandName === 'mute') return muteStems({ ...payload, requester: ctx.requester });
        if (commandName === 'restore') return restoreStems({ ...payload, requester: ctx.requester });
        return _degraded(`Unsupported stems command: ${commandName}`);
    }

    function _registerDomains() {
        capabilities.registerOwner('audio-mix', {
            pluginId: OWNER_ID,
            kind: 'provider-coordinator',
            commands: ['inspect', 'register-participant', 'unregister-participant'],
            operations: ['fader.get-value', 'fader.set-value', 'analyser.get-summary', 'route.get-current'],
            events: ['participant-registered', 'participant-removed', 'fader-changed', 'route-changed', 'route-degraded', 'bridge-hit'],
            safety: 'safe',
            description: 'Coordinates the active player audio mix, route, fader participants, analyser inspection, and audio compatibility bridge usage.',
            handlers: {
                inspect: ctx => _audioMixCommand('inspect', ctx),
                'register-participant': ctx => _audioMixCommand('register-participant', ctx),
                'unregister-participant': ctx => _audioMixCommand('unregister-participant', ctx),
            },
        });
        capabilities.registerOwner('audio-input', {
            pluginId: OWNER_ID,
            kind: 'provider-coordinator',
            commands: ['inspect', 'register-source', 'unregister-source', 'select-source'],
            operations: ['source.enumerate', 'source.describe', 'source.open', 'source.close'],
            events: ['source-registered', 'source-removed', 'source-selected', 'source-availability-changed', 'permission-denied', 'bridge-hit'],
            safety: 'sensitive',
            description: 'Coordinates redaction-safe input source identity, availability, selection, and bridge diagnostics.',
            handlers: {
                inspect: ctx => _audioInputCommand('inspect', ctx),
                'register-source': ctx => _audioInputCommand('register-source', ctx),
                'unregister-source': ctx => _audioInputCommand('unregister-source', ctx),
                'select-source': ctx => _audioInputCommand('select-source', ctx),
            },
        });
        capabilities.registerOwner('audio-monitoring', {
            pluginId: OWNER_ID,
            kind: 'provider-coordinator',
            commands: ['inspect', 'start', 'stop'],
            operations: ['monitoring.start', 'monitoring.stop', 'monitoring.status'],
            events: ['monitoring-start-requested', 'monitoring-started', 'monitoring-stopped', 'monitoring-failed', 'monitoring-unavailable', 'permission-denied', 'bridge-hit'],
            safety: 'sensitive',
            description: 'Coordinates monitoring lifecycle, consent/availability state, and monitoring compatibility bridge diagnostics.',
            handlers: {
                inspect: ctx => _audioMonitoringCommand('inspect', ctx),
                start: ctx => _audioMonitoringCommand('start', ctx),
                stop: ctx => _audioMonitoringCommand('stop', ctx),
            },
        });
        capabilities.registerParticipant(OWNER_ID, {
            stems: {
                roles: ['coordinator'],
                kind: 'provider-coordinator',
                commands: ['inspect', 'mute', 'restore'],
                operations: ['stem.get-state', 'stem.apply-automation', 'stem.restore-automation'],
                events: ['owner-available', 'owner-unavailable', 'automation-applied', 'automation-restored', 'automation-overridden', 'claim-orphaned', 'bridge-hit'],
                safety: 'safe',
                compatibility: 'none',
                ownership: 'multi-provider',
                runtime: true,
                version: 1,
                description: 'Coordinates the active Stems provider and temporary stem automation claims without taking ownership of stem playback.',
                handlers: {
                    inspect: ctx => _stemsCommand('inspect', ctx),
                    mute: ctx => _stemsCommand('mute', ctx),
                    restore: ctx => _stemsCommand('restore', ctx),
                },
            },
        });
    }

    function _registerBridgeMetadata() {
        if (typeof capabilities.registerCompatibilityShim !== 'function') return;
        const shims = [
            { shimId: 'audio-mix.fader-registry', capability: 'audio-mix', source: OWNER_ID, legacySurface: 'window.slopsmith.audio.registerFader', reason: 'Legacy mixer faders are attributed as audio-mix participants.' },
            { shimId: 'audio-mix.song-volume', capability: 'audio-mix', source: OWNER_ID, legacySurface: 'applySongVolume', reason: 'Legacy song volume writes are attributed as audio-mix route/fader bridge hits.' },
            { shimId: 'audio-mix.analyser', capability: 'audio-mix', source: OWNER_ID, legacySurface: '3D Highway analyser fallback', reason: 'Legacy analyser taps are attributed until renderers request analyser providers through audio-mix.' },
            { shimId: 'audio-input.legacy-source', capability: 'audio-input', source: OWNER_ID, legacySurface: 'plugin/browser input source handoff', reason: 'Legacy input source handoffs are attributed while note-detection input providers migrate to audio-input.' },
            { shimId: 'audio-monitoring.audio-barrier', capability: 'audio-monitoring', source: OWNER_ID, legacySurface: 'window.slopsmithAudioBarrier', reason: 'Legacy audio startup barriers are attributed as monitoring readiness bridges.' },
            { shimId: 'stems.master-volume', capability: 'stems', source: OWNER_ID, legacySurface: 'window.slopsmith.stems.setMasterVolume', reason: 'Legacy Stems master volume calls are attributed while native owner operations are staged.' },
            { shimId: 'stems.private-state', capability: 'stems', source: OWNER_ID, legacySurface: 'plugin-specific Stems/NAM ducking handshake', reason: 'Existing stem automation requesters are tracked until they migrate to native claims.' },
        ];
        for (const shim of shims) capabilities.registerCompatibilityShim({ ...shim, status: 'active' });
    }

    function _contributeDiagnostics() {
        const diagnostics = window.slopsmith && window.slopsmith.diagnostics;
        if (diagnostics && typeof diagnostics.contribute === 'function') {
            try { diagnostics.contribute('audio-session', snapshot()); }
            catch (_) { /* diagnostics must not break playback */ }
        }
    }

    const api = {
        version: 1,
        startSession,
        stopSession,
        setRoute,
        registerMixParticipant,
        unregisterMixParticipant,
        registerInputSource,
        unregisterInputSource,
        selectInputSource,
        startMonitoring,
        stopMonitoring,
        registerStemOwner,
        muteStems,
        restoreStems,
        recordStemManualOverride,
        recordBridgeHit,
        recordOutcome: (entry) => { const outcome = _recordOutcome(entry); _touch(); return _clone(outcome); },
        snapshot,
        getDiagnostics: snapshot,
    };

    window.slopsmith.audioSession = api;
    _registerDomains();
    _registerBridgeMetadata();
    _contributeDiagnostics();
})();