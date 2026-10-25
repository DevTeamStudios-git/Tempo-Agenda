/**
 * Centralized config for pure React Native CLI.
 * Reads from react-native-config (.env file, no EXPO_PUBLIC_ prefix).
 */
import Config from 'react-native-config';

export const SUPABASE_URL = Config.SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = Config.SUPABASE_ANON_KEY ?? '';
export const TEMPO_API_URL = Config.TEMPO_API_URL ?? 'http://10.0.2.2:3100';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    'Missing SUPABASE_URL / SUPABASE_ANON_KEY — auth will fail. Copy .env.example to .env',
  );
}
