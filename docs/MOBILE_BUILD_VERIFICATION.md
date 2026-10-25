# Native build verification — October 25, 2026

Android debug APK built successfully with JDK 17, Gradle 8.10.2, React Native 0.76.7 and Android compile SDK 35. Package: com.tempo.agenda. Minimum SDK: 24; target SDK: 34. Native libraries cover arm64-v8a, armeabi-v7a, x86 and x86_64. Native TypeScript, ESLint and Metro Android bundling passed.

Installer: mobile/android/app/build/outputs/apk/debug/app-debug.apk. This development APK requires Metro on port 8081 and the configured web API on port 3100. It has not been exercised on a physical device. It is not a store-signed release; a store release needs a deployed HTTPS API, current platform target requirements, release signing and device validation.

The native app implements sign-in, month/agenda views, event CRUD and recurrence scope, calendar management, permission controls and reviewed AI actions. The responsive web app retains advanced tools such as imports/exports, notebooks, tasks and printing.

iOS project files and app icons are included. macOS, Xcode, CocoaPods and a signing team are required for iOS compilation and distribution; those checks cannot run on this Windows host.

Windows native path limits are handled by moving CMake staging out of the long node_modules path. No global OS security settings were changed.
