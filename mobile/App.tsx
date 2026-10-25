import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  Linking,
  Platform,
  NativeModules,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import type { Session } from '@supabase/supabase-js';
import * as Keychain from 'react-native-keychain';
import {
  isTrustedWorkspaceUrl,
  workspaceNavigation,
} from '../shared/mobile-policy';
import { TEMPO_API_URL, SUPABASE_URL } from './src/lib/config';
import { beginNativeOAuth, completeNativeOAuth } from './src/lib/native-oauth';
const BASE = TEMPO_API_URL.replace(/\/$/, '');
const ORIGIN = new URL(BASE).origin;
const secureServer = __DEV__ || new URL(BASE).protocol === 'https:';
const HOME = BASE + '/mobile';
const CONNECT = BASE + '/mobile/connect';
const Device = NativeModules.TempoDevice as {
  saveFile: (name: string, mime: string, content: string) => Promise<boolean>;
  print: (html: string, baseURL: string) => Promise<void>;
};
function Workspace() {
  const currentUrl = useRef(HOME);
  const web = useRef<WebView>(null),
    pendingSession = useRef<Session | null>(null),
    legacy = useRef(false),
    canGoBack = useRef(false),
    handledCode = useRef('');
  const [source, setSource] = useState({ uri: HOME }),
    [booting, setBooting] = useState(true),
    [loading, setLoading] = useState(true),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(''),
    [dark, setDark] = useState(true),
    [background, setBackground] = useState('#131314');
  const ink = dark ? '#e3e3e3' : '#1f1f1f';
  const accent = dark ? '#a8c7fa' : '#0b57d0';
  const send = useCallback(
    (message: unknown) => web.current?.postMessage(JSON.stringify(message)),
    [],
  );
  const connect = useCallback((session: Session) => {
    pendingSession.current = session;
    setError('');
    setSource({ uri: CONNECT });
    if (currentUrl.current === CONNECT) {web.current?.reload();}
  }, []);
  useEffect(() => {
    let active = true;
    async function restore() {
      if (!secureServer) {
        setError('Configure an HTTPS Tempo backend for a release build.');
        setBooting(false);
        return;
      }
      try {
        const { supabase } = await import('./src/lib/supabase');
        const { data } = await supabase.auth.getSession();
        await supabase.auth.stopAutoRefresh();
        if (data.session && active) {
          legacy.current = true;
          connect(data.session);
        }
      } catch {
        /* The workspace's own persisted cookies or sign-in screen remain available. */
      } finally {
        if (active) {
          setBooting(false);
        }
      }
    }
    void restore();
    return () => {
      active = false;
    };
  }, [connect]);
  useEffect(() => {
    async function callback(url: string | null) {
      if (!url) {
        return;
      }
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return;
      }
      if (
        parsed.protocol !== 'tempo:' ||
        parsed.hostname !== 'auth' ||
        parsed.pathname !== '/callback'
      ) {
        return;
      }
      const code = parsed.searchParams.get('code');
      if (!code || handledCode.current === code) {
        return;
      }
      handledCode.current = code;
      try {
        const session = await completeNativeOAuth(
          code,
          parsed.searchParams.get('flow'),
        );
        connect(session);
      } catch (e) {
        Alert.alert('Sign-in could not finish', (e as Error).message);
      }
    }
    const subscription = Linking.addEventListener(
      'url',
      (event) => void callback(event.url),
    );
    void Linking.getInitialURL().then(callback);
    return () => subscription.remove();
  }, [connect]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        send({ type: 'tempo:foreground' });
      }
    });
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      web.current?.injectJavaScript(
        'window.dispatchEvent(new Event("tempo-native-back"));true;',
      );
      return true;
    });
    return () => {
      subscription.remove();
      back.remove();
    };
  }, [send]);
  async function oauth() {
    try {
      const url = await beginNativeOAuth(BASE + '/auth/callback?native=1');
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Google sign-in', (e as Error).message);
    }
  }
  async function onMessage(event: WebViewMessageEvent) {
    if (!isTrustedWorkspaceUrl(event.nativeEvent.url, ORIGIN)) {
      return;
    }
    if (event.nativeEvent.data.length > 8_000_000) {
      return;
    }
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (message.type === 'tempo:theme') {
      if (typeof message.dark === 'boolean') {
        setDark(message.dark);
      }
      if (
        typeof message.background === 'string' &&
        /^#[0-9a-fA-F]{6}$/.test(message.background)
      ) {
        setBackground(message.background);
      }
      return;
    }
    if (
      message.type === 'tempo:session-ready' &&
      new URL(currentUrl.current).pathname === '/mobile/connect' &&
      pendingSession.current
    ) {
      const session = pendingSession.current;
      send({
        type: 'tempo:session',
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
      });
      return;
    }
    if (message.type === 'tempo:session-applied') {
      pendingSession.current = null;
      if (legacy.current) {
        legacy.current = false;
        const service =
          'sb-' + new URL(SUPABASE_URL).hostname.split('.')[0] + '-auth-token';
        await Keychain.resetGenericPassword({ service });
      }
      return;
    }
    if (message.type === 'tempo:oauth' && message.provider === 'google') {
      await oauth();
      return;
    }
    if (message.type === 'tempo:back-unhandled') {
      if (canGoBack.current) {
        web.current?.goBack();
      } else {
        BackHandler.exitApp();
      }
      return;
    }
    if (message.type === 'tempo:error') {
      Alert.alert('Tempo', String(message.message ?? 'Please sign in again.'));
      pendingSession.current = null;
      setSource({ uri: BASE + '/login?next=/mobile' });
      return;
    }
    if (message.type !== 'tempo:save' && message.type !== 'tempo:print') {
      return;
    }
    try {
      if (message.type === 'tempo:save') {
        if (
          typeof message.filename !== 'string' ||
          typeof message.content !== 'string' ||
          typeof message.mime !== 'string' ||
          message.content.length > 5_000_000
        ) {
          throw new Error('Invalid export.');
        }
        if (!Device?.saveFile) {
          throw new Error('Update the native app to enable file exports.');
        }
        await Device.saveFile(
          message.filename.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 100),
          message.mime,
          message.content,
        );
      } else {
        if (
          typeof message.html !== 'string' ||
          message.html.length > 5_000_000
        ) {
          throw new Error('Invalid print document.');
        }
        if (!Device?.print) {
          throw new Error('Update the native app to enable printing.');
        }
        await Device.print(message.html, BASE + '/');
      }
      send({
        type: 'tempo:result',
        kind: message.type === 'tempo:print' ? 'print' : 'save',
        id: message.id,
      });
    } catch (e) {
      send({
        type: 'tempo:result',
        kind: message.type === 'tempo:print' ? 'print' : 'save',
        id: message.id,
        error: (e as Error).message,
      });
      Alert.alert('Tempo', (e as Error).message);
    }
  }
  function allowNavigation(url: string) {
    const policy = workspaceNavigation(url, ORIGIN);
    if (policy === 'internal') {
      return true;
    }
    if (policy === 'external') {
      void Linking.openURL(url).catch(() => Alert.alert('Could not open link'));
    }
    return false;
  }
  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: background }]}
      edges={['top', 'bottom', 'left', 'right']}
    >
      <StatusBar
        barStyle={dark ? 'light-content' : 'dark-content'}
        backgroundColor={background}
      />
      {booting ? (
        <View style={styles.center}>
          <ActivityIndicator color={accent} />
          <Text style={[styles.label, { color: ink }]}>Opening Tempo…</Text>
        </View>
      ) : secureServer ? (
        <>
          <WebView
            ref={web}
            source={source}
            style={[styles.web, { backgroundColor: background }]}
            containerStyle={{ backgroundColor: background }}
            onMessage={(event) => void onMessage(event)}
            onShouldStartLoadWithRequest={(request) =>
              allowNavigation(request.url)
            }
            onOpenWindow={(event) => {
              allowNavigation(event.nativeEvent.targetUrl);
            }}
            onNavigationStateChange={(state) => {
              currentUrl.current = state.url;
              canGoBack.current = state.canGoBack;
            }}
            onLoadStart={() => setLoading(true)}
            onLoadProgress={(event) => setProgress(event.nativeEvent.progress)}
            onLoadEnd={(event) => {
              setLoading(false);
              if (
                Platform.OS === 'android' &&
                new URL(event.nativeEvent.url).pathname === '/mobile'
              ) {
                web.current?.clearHistory?.();
                canGoBack.current = false;
              }
            }}
            onError={() => {
              setLoading(false);
              setError(
                'Could not connect to Tempo. Check your connection and that the backend is running.',
              );
            }}
            onHttpError={(event) => {
              if (event.nativeEvent.url === source.uri) {
                setLoading(false);
                setError(
                  'Tempo returned an error (' +
                    event.nativeEvent.statusCode +
                    ').',
                );
              }
            }}
            onRenderProcessGone={() => {
              setLoading(false);
              setError('The calendar view needs to restart.');
            }}
            domStorageEnabled
            javaScriptEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled={false}
            setSupportMultipleWindows={false}
            mixedContentMode="never"
            allowsBackForwardNavigationGestures
            allowsLinkPreview={false}
            automaticallyAdjustContentInsets={false}
            contentInsetAdjustmentBehavior="never"
            applicationNameForUserAgent="TempoMobile/2"
            webviewDebuggingEnabled={__DEV__}
            geolocationEnabled={false}
            allowFileAccess={false}
            allowUniversalAccessFromFileURLs={false}
          />
          {loading && !error && (
            <View
              accessibilityLabel="Loading calendar"
              style={[
                styles.progress,
                {
                  backgroundColor: accent,
                  width: (Math.max(0.08, progress) * 100 + '%') as `${number}%`,
                },
              ]}
            />
          )}
        </>
      ) : null}
      {!!error && (
        <View style={[styles.failure, { backgroundColor: background }]}>
          <Text style={[styles.title, { color: ink }]}>
            Your calendar will be right back.
          </Text>
          <Text style={[styles.label, { color: ink }]}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            style={[styles.retry, { backgroundColor: accent }]}
            onPress={() => {
              setError('');
              web.current?.reload();
            }}
          >
            <Text
              style={{ color: dark ? '#131314' : '#ffffff', fontWeight: '600' }}
            >
              Try again
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <Workspace />
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  web: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  label: { fontSize: 15, lineHeight: 23, marginTop: 16, textAlign: 'center' },
  progress: { position: 'absolute', top: 0, left: 0, height: 3 },
  failure: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  title: { fontSize: 24, fontWeight: '600', textAlign: 'center' },
  retry: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 24,
  },
});
