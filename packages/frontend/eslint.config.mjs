import globals from 'globals'
import pluginJs from '@eslint/js'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactRecommended from 'eslint-plugin-react/configs/recommended.js'
import reactHooks from 'eslint-plugin-react-hooks'

/** @type {import('@typescript-eslint/utils').TSESLint.FlatConfig.ConfigFile} */
export default [
  {
    languageOptions: { globals: globals.browser },
    rules: {
      'no-console': 'warn',
      'prefer-const': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
    }
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    ...reactRecommended,
    plugins: {
      react,
      "react-hooks": reactHooks
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      }
    },
    rules: {
      ...reactHooks.configs.recommended.rules
    }
  }
]
