import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@subtrack/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts', '!src/app.ts'],
  coverageThreshold: {
    global: { lines: 80 }, // CLAUDE.md §12 — 핵심 비즈니스 로직 80% 이상
  },
};

export default config;
