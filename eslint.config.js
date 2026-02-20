const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const prettierConfig = require('eslint-config-prettier');
const prettierPlugin = require('eslint-plugin-prettier');
const globals = require('globals');

module.exports = tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.js'],
    plugins: {
      prettier: prettierPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        Env: 'readonly',
        DurableObjectState: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        fetch: 'readonly',
        Headers: 'readonly',
        crypto: 'readonly',
      },
    },
    rules: {
      'prettier/prettier': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off', // Allow and let TS handle it if needed
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-undef': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@google/generative-ai',
              message: 'Use @google/genai instead of the deprecated @google/generative-ai SDK. See Global Rule #1.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^gemini-(1\\.5|2\\.0)/]',
          message: 'Hardcoded legacy Gemini models are not allowed. Use the `-latest` aliases defined in src/models.ts. See Global Rule #1.',
        },
      ],
    },
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts', 'scripts/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['workers/custom-router/src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './workers/custom-router/tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
  },
  prettierConfig,
  {
    ignores: [
      'dist/',
      'node_modules/',
      'workers/custom-router/dist/',
      'workers/custom-router/worker-configuration.d.ts',
    ],
  },
);
