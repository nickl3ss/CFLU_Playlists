import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly', document: 'readonly', console: 'readonly',
        navigator: 'readonly', sessionStorage: 'readonly', localStorage: 'readonly',
        location: 'readonly', history: 'readonly',
        fetch: 'readonly', URL: 'readonly', URLSearchParams: 'readonly',
        Blob: 'readonly', FormData: 'readonly', FileReader: 'readonly',
        crypto: 'readonly', btoa: 'readonly', TextEncoder: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly', requestAnimationFrame: 'readonly',
        alert: 'readonly', getComputedStyle: 'readonly',
        // CFLU global (loaded via non-module <script>)
        TRACK_DATA: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],  // != null catches undefined — valid JS idiom
      'no-var': 'error',
      'prefer-const': 'warn',
    },
  },
  {
    // cflu_tests.js runs in both Node.js (process.exit) and browser
    files: ['js/cflu_tests.js'],
    languageOptions: {
      globals: { process: 'readonly' },
    },
  },
];
