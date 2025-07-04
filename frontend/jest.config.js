module.exports = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+.tsx?$': ['@swc/jest', {}],
  },
  moduleNameMapper: {
    '^@mediatool/shared$': '<rootDir>/../shared/src/index.ts',
    '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },
  rootDir: __dirname,
  testMatch: ['**/?(*.)test.{ts,tsx}'],
  setupFilesAfterEnv: ['<rootDir>/src/test-utils/setup.ts'],
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/test-utils/**',
    '!src/**/*.d.ts',
    '!src/main.tsx',
  ],
};
