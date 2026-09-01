import { defineConfig } from 'tsup';

export default defineConfig([
  // 1. ESM & CommonJS builds for modern bundlers and Node environments
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    cjsInterop: true,
  },
  // 2. Browser IIFE build for direct CDN / <script> tag usage in Liquid themes
  {
    entry: { 'crafter.min': 'src/index.ts' },
    format: ['iife'],
    globalName: 'CrafterSDK',
    minify: true,
    sourcemap: true,
    clean: false,
    outExtension() {
      return {
        js: '.js',
      };
    },
    footer: {
      js: `if (typeof window !== "undefined" && window.CrafterSDK) {
  window.Crafter = window.CrafterSDK.Crafter || window.CrafterSDK.default || window.CrafterSDK;
}`,
    },
  },
]);
