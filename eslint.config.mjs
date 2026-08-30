import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    // build output: the bundles at the root and everything generated into _site/
    ignores: [
      'video-background*.js',
      '_site/**',
      '**/*.map',
      'node_modules/**'
    ]
  },
  js.configs.recommended,
  {
    files: ['src/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2019,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        // injected by the player APIs, not imported
        YT: 'readonly',
        Vimeo: 'readonly'
      }
    }
  },
  {
    files: ['src/__tests__/**/*.mjs'],
    languageOptions: {
      globals: globals.jest
    }
  },
  {
    files: ['script/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: globals.node
    }
  },
  {
    files: ['*.config.js', 'jest.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node
    }
  }
];
