import { NativeModules } from 'react-native';
import * as Keychain from 'react-native-keychain';
import type { Session } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';
const SERVICE = 'tempo.oauth.pkce';
// Match Supabase's documented PKCE authorize/token flow, using native secure randomness and SHA-256.
export async function beginNativeOAuth(callback: string) {
  const device = NativeModules.TempoDevice as {
    createPkce: () => Promise<{
      verifier: string;
      challenge: string;
      flow: string;
    }>;
  };
  if (!device?.createPkce) {
    throw new Error('Rebuild the native app to enable Google sign-in.');
  }
  const flow = await device.createPkce();
  await Keychain.setGenericPassword(
    'tempo',
    JSON.stringify({ ...flow, expires: Date.now() + 600000 }),
    {
      service: SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    },
  );
  const redirect = new URL(callback);
  redirect.searchParams.set('flow', flow.flow);
  const url = new URL(SUPABASE_URL + '/auth/v1/authorize');
  url.searchParams.set('provider', 'google');
  url.searchParams.set('redirect_to', redirect.toString());
  url.searchParams.set('code_challenge', flow.challenge);
  url.searchParams.set('code_challenge_method', 's256');
  return url.toString();
}
export async function completeNativeOAuth(
  code: string,
  flow: string | null,
): Promise<Session> {
  if (!flow || !/^([a-f0-9]{32})$/.test(flow)) {
    throw new Error('This sign-in link is invalid. Please try again.');
  }
  const item = await Keychain.getGenericPassword({ service: SERVICE });
  if (!item) {
    throw new Error('Sign-in expired. Please try again.');
  }
  const pending = JSON.parse(item.password) as {
    verifier: string;
    flow: string;
    expires: number;
  };
  if (pending.flow !== flow || pending.expires < Date.now()) {
    throw new Error('Sign-in expired. Please try again.');
  }
  try {
    const response = await fetch(
      SUPABASE_URL + '/auth/v1/token?grant_type=pkce',
      {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth_code: code,
          code_verifier: pending.verifier,
        }),
      },
    );
    const result = await response.json();
    if (!response.ok || !result.access_token || !result.refresh_token) {
      throw new Error(
        result.msg ?? result.message ?? 'Google sign-in did not finish.',
      );
    }
    return {
      ...result,
      expires_at:
        result.expires_at ?? Math.floor(Date.now() / 1000) + result.expires_in,
    } as Session;
  } finally {
    await Keychain.resetGenericPassword({ service: SERVICE });
  }
}
