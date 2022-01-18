module.exports = {
  extends: ['eslint:recommended', 'plugin:prettier/recommended'],
  plugins: ['@typescript-eslint'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2019,
    sourceType: 'module'
  },
  env: {
    node: true,
    es6: true
  },
  rules: {
    'no-console': 'error',
    'no-unused-vars': 'warn',
    'prefer-const': 'error',
    '@typescript-eslint/no-unused-vars': 'warn'
  }
}
