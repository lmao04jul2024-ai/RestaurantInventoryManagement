/**
 * Metro config for an npm-workspaces monorepo.
 *
 * Dependencies are hoisted to the ROOT node_modules by npm workspaces, so Metro
 * must be told to watch the workspace root and resolve modules there too, or
 * every third-party import fails to bundle ("Unable to resolve module ...").
 * The shared package's TypeScript sources are also watched directly so edits
 * to packages/shared hot-reload inside the app without a build step.
 */
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..', '..');

const config = {
  watchFolders: [path.resolve(workspaceRoot, 'packages', 'shared')],
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
