module.exports = {
  testPathIgnorePatterns: ['/node_modules/', '/tests/', '/e2e/'],
  projects: [
    {
      displayName: 'backend',
      testEnvironment: 'node',
      transform: {
        '^.+.tsx?$': ['@swc/jest', {}],
      },
      moduleNameMapper: {
        '^@mediatool/shared$': '<rootDir>/../shared/src/index.ts',
      },
      rootDir: './backend',
      testMatch: ['**/?(*.)test.ts?(x)'],
      testPathIgnorePatterns: ['/node_modules/', '/tests/', '/e2e/'],
      setupFilesAfterEnv: ['<rootDir>/src/scripts/jest-dbtest-setup.ts'],
      coverageDirectory: '<rootDir>/coverage',
      collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.test.{ts,tsx}',
        '!src/scripts/**',
        '!src/**/*.d.ts',
        '!src/index.ts',
      ],
    },
    {
      displayName: 'frontend',
      testEnvironment: 'jsdom',
      transform: {
        '^.+.tsx?$': ['@swc/jest', {}],
      },
      moduleNameMapper: {
        '^@mediatool/shared$': '<rootDir>/../shared/src/index.ts',
        '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
        '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
      },
      rootDir: './frontend',
      testMatch: ['**/?(*.)test.{ts,tsx}'],
      testPathIgnorePatterns: ['/node_modules/', '/tests/', '/e2e/'],
      setupFilesAfterEnv: ['<rootDir>/src/test-utils/setup.ts'],
      coverageDirectory: '<rootDir>/coverage',
      collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.test.{ts,tsx}',
        '!src/test-utils/**',
        '!src/**/*.d.ts',
        '!src/main.tsx',
        '!src/vite-env.d.ts',
      ],
    },
    {
      displayName: 'shared',
      testEnvironment: 'node',
      transform: {
        '^.+.tsx?$': ['@swc/jest', {}],
      },
      rootDir: './shared',
      testMatch: ['**/?(*.)test.{ts,tsx}'],
      testPathIgnorePatterns: ['/node_modules/', '/tests/', '/e2e/'],
      coverageDirectory: '<rootDir>/coverage',
      collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.test.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/index.ts',
      ],
    },
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
};
