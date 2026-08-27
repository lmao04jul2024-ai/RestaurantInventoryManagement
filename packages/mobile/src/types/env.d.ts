/**
 * Ambient declaration: the app reads at most RMS_API_URL from Metro-inlined
 * env (react-native ships no Node `@types/node`). Everything else resolves at
 * runtime via src/config.ts platform defaults.
 */
declare const process: {
  env: {
    RMS_API_URL?: string;
    NODE_ENV?: 'development' | 'production' | 'test';
  };
};
