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
    // Server and build tooling
    files: ['*.js'],
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
    // Browser bundles, which are plain scripts sharing globals rather than modules
    files: ['source/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, ...globals.jquery }
    },
    rules: {
      ...sharedRules,
      'no-unused-vars': 'off'
    }
  }
];
