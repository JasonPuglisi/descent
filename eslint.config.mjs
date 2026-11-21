import js from '@eslint/js';
import globals from 'globals';

let sharedRules = {
  'indent': ['error', 2, { 'SwitchCase': 1 }],
  'linebreak-style': ['error', 'unix'],
  'quotes': ['error', 'single'],
  'semi': ['error', 'always'],
  'no-var': 'error',
  'prefer-arrow-callback': 'error'
};

export default [
  {
    ignores: ['node_modules/**', 'public/javascripts/**', 'public/stylesheets/**']
  },
  js.configs.recommended,
  {
    // Server, build tooling and tests
    files: ['*.js', 'lib/**/*.js', 'test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node
    },
    rules: {
      ...sharedRules,
      'no-console': ['error', { 'allow': ['info', 'warn', 'error'] }],
      'no-trailing-spaces': 'error'
    }
  },
  {
    // Browser modules. Color Thief and chroma.js still load as classic scripts
    // from the CDN, so the files that use them declare those globals.
    files: ['source/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.browser
    },
    rules: {
      ...sharedRules
    }
  }
];
