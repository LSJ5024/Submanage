module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: ['./tsconfig.base.json', './packages/*/tsconfig.json', './services/api/tsconfig.json', './apps/*/tsconfig.json'],
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  rules: {
    // any 타입 사용 금지 (CLAUDE.md §5)
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',

    // Promise.then 체이닝 지양, async/await 사용 권장 (CLAUDE.md §5)
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/prefer-promise-reject-errors': 'error',

    // import 순서 (CLAUDE.md §5)
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        pathGroups: [
          { pattern: '@subtrack/**', group: 'internal', position: 'before' },
        ],
        pathGroupsExcludedImportTypes: ['builtin'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],

    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/consistent-type-imports': 'error',
    'no-console': 'warn',
  },
  settings: {
    'import/resolver': {
      typescript: { alwaysTryTypes: true },
    },
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.js', '!.eslintrc.js'],
};
