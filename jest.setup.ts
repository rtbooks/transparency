// Jest setup file
import '@testing-library/jest-dom';

// Mock environment variables for tests
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
// @ts-expect-error - NODE_ENV is readonly but we need to set it for tests
process.env.NODE_ENV = 'test';
