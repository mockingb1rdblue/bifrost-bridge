const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const prettierConfig = require('eslint-config-prettier');
const prettierPlugin = require('eslint-plugin-prettier');
const globals = require('globals');
const pluginJsdoc = require('eslint-plugin-jsdoc');

module.exports = tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.js'],
    plugins: {
      prettier: prettierPlugin,
      jsdoc: pluginJsdoc,
    },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        Env: 'readonly',
        DurableObjectState: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        RequestInit: 'readonly',
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
              message:
                'Use @google/genai instead of the deprecated @google/generative-ai SDK. See Global Rule #1.',
            },
            {
              name: 'dotenv',
              message:
                'Direct use of dotenv is prohibited. Secrets must be loaded via the "Zero Local Secrets" vault (npm run secure:exec). See Global Pillar #3.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^gemini-(1\\.5|2\\.0)/]',
          message:
            'Hardcoded legacy Gemini models are not allowed. Use the `-latest` aliases defined in src/models.ts. See Global Rule #1.',
        },
        {
          selector: 'MemberExpression[object.name="process"][property.name="env"]',
          message:
            'Direct access to process.env is forbidden outside of infrastructure/config modules. Use validated config schemas (Valibot) or the secure vault. See Global Pillar #3.',
        },
        {
          selector:
            'Identifier[name=/Swarm|Sprite|Agent|System|Utility|Backlog|TaskQueue|Dashboard/]',
          message:
            'Forbidden Bleached term detected. Use Dark Mythology alternatives (Celtic/Slavic folklore). See .agent/workflows/naming-enforcement.md.',
        },
      ],
      'jsdoc/require-jsdoc': [
        'warn',
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
          },
        },
      ],
      'jsdoc/require-description': 'warn',
      'jsdoc/check-alignment': 'warn',
      'jsdoc/check-param-names': 'warn',
    },
  },
  {
    files: [
      'src/config/**/*.ts',
      'scripts/infra/**/*.ts',
      'scripts/library/**/*.ts',
      'workers/worker-bees/src/config/**/*.ts',
    ],
    rules: {
      'no-restricted-syntax': 'off', // Allow process.env in config/infra entry points
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
