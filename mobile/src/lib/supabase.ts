import { createClient } from '@supabase/supabase-js';
import * as Keychain from 'react-native-keychain';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';
// Auth sessions are persisted only in the platform credential store.
const storage = {
  async getItem(key: string) {
    const item = await Keychain.getGenericPassword({ service: key });
    return item ? item.password : null;
  },
  async setItem(key: string, value: string) {
    await Keychain.setGenericPassword(key, value, {
      service: key,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  async removeItem(key: string) {
    await Keychain.resetGenericPassword({ service: key });
  },
};
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
