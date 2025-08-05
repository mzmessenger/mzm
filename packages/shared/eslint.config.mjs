import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['dist/**']
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      'no-console': 'warn',
      'prefer-const': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn', {
          caughtErrorsIgnorePattern: '^_',
          caughtErrors: 'none'
        }
      ]
    }
  }
]
