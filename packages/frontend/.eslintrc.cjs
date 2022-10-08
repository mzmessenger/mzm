module.exports = {
  extends: ['eslint:recommended', 'prettier', 'plugin:react-hooks/recommended'],
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2019,
    ecmaFeatures: {
      jsx: true
    },
    useJSXTextNode: true,
    sourceType: 'module'
  },
  env: {
    browser: true,
    es6: true,
    node: true
  },
  rules: {
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-unused-vars': 'off',
    'react/jsx-uses-vars': 'error',
    'react/jsx-uses-react': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { args: 'none', argsIgnorePattern: '^_' }
    ]
  }
}
