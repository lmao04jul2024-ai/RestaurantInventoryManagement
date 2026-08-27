/**
 * Runtime configuration for the mobile app.
 * Android emulators cannot reach host "localhost" — they map to 10.0.2.2.
 */
import { Platform } from 'react-native';

function defaultApiUrl(): string {
  if (__DEV__ && Platform.OS === 'android') {
    return 'http://10.0.2.2:3001';
  }
  return 'http://localhost:3001';
}

export const API_BASE_URL =
  process.env.RMS_API_URL ?? defaultApiUrl();
