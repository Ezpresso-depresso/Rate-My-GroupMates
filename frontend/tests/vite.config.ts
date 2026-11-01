import { defineConfig, mergeConfig } from 'vite';
import appConfig from '../vite.config';

// Keep test dependency optimization separate from a teammate's running dev server.
export default mergeConfig(appConfig, defineConfig({ cacheDir: 'node_modules/.vite-afterparty-tests' }));
