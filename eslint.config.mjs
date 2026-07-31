import eslint from '@eslint/js';

export default [
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      '.astro/',
      '.wrangler/',
      '.turbo/',
    ],
  },
  {
    // TypeScript files are checked by tsc --noEmit (typecheck task).
    // ESLint lints JS/MJS config and script files only until
    // typescript-eslint supports TypeScript 7.
    files: ['**/*.{js,mjs,cjs}'],
    ...eslint.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
];
