import { describe, it } from 'node:test';
import assert from 'node:assert';
import { C2S, S2C } from '../src/sync/protocol.ts';

/** Helper to parse guest controls event payload across formats */
export function parseGuestControlsPayload(payload: any): boolean {
  if (typeof payload === 'boolean') return payload;
  if (payload && payload.allow_guest_controls !== undefined) {
    return Boolean(payload.allow_guest_controls);
  }
  if (payload && payload.enabled !== undefined) {
    return Boolean(payload.enabled);
  }
  return false;
}

/** Helper to format OAuth error codes into user-friendly messages */
export function formatAuthError(errorCode?: string | null): string {
  if (!errorCode) {
    return 'The sign-in window was closed or timed out. You can retry or join as a guest.';
  }
  const clean = errorCode.replace(/^error=/, '').replace(/_/g, ' ');
  return `Discord sign-in was interrupted (${clean}). You can retry or continue as a guest.`;
}

describe('Room Management Protocol & Auth Fallback', () => {
  it('includes ROOM_UPDATED and ROOM_CLOSED in S2C events', () => {
    assert.strictEqual(S2C.ROOM_UPDATED, 'room_updated');
    assert.strictEqual(S2C.ROOM_CLOSED, 'room_closed');
    assert.strictEqual(S2C.GUEST_CONTROLS_UPDATED, 'guest_controls_updated');
  });

  it('includes TOGGLE_GUEST_CONTROLS in C2S events', () => {
    assert.strictEqual(C2S.TOGGLE_GUEST_CONTROLS, 'toggle_guest_controls');
  });

  it('correctly parses guest controls payload from backend with allow_guest_controls', () => {
    assert.strictEqual(parseGuestControlsPayload({ allow_guest_controls: true }), true);
    assert.strictEqual(parseGuestControlsPayload({ allow_guest_controls: false }), false);
  });

  it('correctly parses legacy boolean or enabled field for guest controls', () => {
    assert.strictEqual(parseGuestControlsPayload(true), true);
    assert.strictEqual(parseGuestControlsPayload(false), false);
    assert.strictEqual(parseGuestControlsPayload({ enabled: true }), true);
    assert.strictEqual(parseGuestControlsPayload({ enabled: false }), false);
    assert.strictEqual(parseGuestControlsPayload(null), false);
  });

  it('formats OAuth error codes into human-readable recovery messages', () => {
    const accessDenied = formatAuthError('access_denied');
    assert.ok(accessDenied.includes('access denied'));
    assert.ok(accessDenied.includes('retry or continue as a guest'));

    const tokenFailed = formatAuthError('discord_token_failed');
    assert.ok(tokenFailed.includes('discord token failed'));

    const defaultMsg = formatAuthError(null);
    assert.ok(defaultMsg.includes('closed or timed out'));
  });
});
