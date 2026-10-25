# Tempo mobile

The native companion lives inside the canonical Tempo repository. It uses the same Supabase sign-in and Next.js API/database as the web app; it never contains a database password or AI server key.

The native app displays the same responsive calendar workspace as the browser: Day, Week, Month, Agenda, Book, Year and Notebook, with the same event editor, calendar management, tasks, notifications, settings, AI permissions and reviewed actions. A compact toolbar, scrollable week grid, bottom navigation and safe areas adapt it to phones and tablets. It starts in dark mode unless a theme was already chosen.

## Run

1. Copy .env.example to .env. Use the web app's public Supabase URL and publishable/anon key.
2. Set TEMPO_API_URL to the running web backend. Android emulator development uses http://10.0.2.2:3100. iOS simulator uses http://localhost:3100. Physical phones need a reachable LAN host or deployed HTTPS URL. Release builds require HTTPS.
3. Run npm ci in this directory. Start the web backend on port 3100.
4. Run npm start, then npm run android. Android requires JDK 17 and Android SDK/NDK specified by android/build.gradle.
5. On macOS, run bundle install, cd ios, bundle exec pod install, then npm run ios. Signing/team configuration is required for a physical iPhone.

## Checks and packaging

npm run typecheck checks native TypeScript. npm run build:android-debug creates android/app/build/outputs/apk/debug/app-debug.apk; Metro must be running for this development build. Release signing must be configured with your own private key. iOS builds require macOS/Xcode and have not been validated on this Windows host.

Imports use the system file picker. Exports open the native save/share sheet, and printing uses the system print dialog. The shared workspace requires a reachable Tempo backend; this is not an offline calendar. Browser sessions persist in the embedded browser. Sessions from the previous companion app migrate once from Keychain/Keystore. Google sign-in opens the system browser and returns through a PKCE-protected tempo:// callback.

In Supabase Auth, allow the deployed backend callback URL with its native query parameters (for example https://your-host/auth/callback**). Keep the normal browser callback allowed as well. Only public Supabase configuration belongs in the mobile environment.

Metro is installed locally by npm ci. From the repository root run npm run mobile:install, then npm run mobile:start; keep that terminal open and run npm run mobile:android in a second terminal. Vercel serves the web/API; Metro is only used for local native development.

## Android SDK detection

The Android run/build scripts detect ANDROID_HOME, ANDROID_SDK_ROOT, android/local.properties, and the standard SDK location for Windows/macOS/Linux. They configure the child process environment and write the ignored local.properties file, so a new terminal does not need manual SDK environment settings. Run npm run android:setup inside mobile to inspect/configure detection. If no device is connected, configure an AVD in Android Studio Device Manager, or connect an Android phone with USB debugging enabled.
