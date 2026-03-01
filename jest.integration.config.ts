import type { Config } from 'jest';

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'node',
  // No jest.setup.ts — integration tests use the real DATABASE_URL from env
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      // Use ESM mode for import.meta support in Prisma generated code
      useESM: true,
    }],
  },
  // Enable ESM support in Jest
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Allow transforming Prisma's ESM runtime files
  transformIgnorePatterns: [
    'node_modules/(?!(@prisma/client)/)',
  ],
  testMatch: [
    '**/__tests__/integration/**/*.integration.test.ts',
  ],
  testTimeout: 30000,
};

export default config;
