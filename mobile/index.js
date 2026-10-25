/**
 * Pure React Native CLI entry (no Expo).
 * Open this project in Android Studio via the android/ folder,
 * or run: npx react-native run-android
 */
import 'react-native-url-polyfill/auto';
import 'react-native-gesture-handler';
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
