import type { Config } from 'jest';
import nextJest from 'next/jest';

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.tsx',
    '!src/app/**', // Exclude Next.js app directory (mostly routing)
    '!src/components/ui/**', // Exclude shadcn components
  ],
  coverageThreshold: {
    global: {
      // Baseline — raise as we add component and route handler tests
      statements: 2,
      branches: 2,
      functions: 2,
      lines: 2,
    },
    // Service layer: core business logic must maintain coverage
    'src/services/': {
      branches: 50,
      functions: 40,
      lines: 45,
      statements: 45,
    },
    // Library utilities: critical shared code
    'src/lib/': {
      branches: 30,
      functions: 30,
      lines: 30,
      statements: 30,
    },
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config);
