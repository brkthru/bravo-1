module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+.tsx?$': ['@swc/jest', {}]
  },
  moduleNameMapper: {
    '^@mediatool/shared$': '<rootDir>/../shared/src/index.ts'
  },
  rootDir: __dirname,
  testMatch: ['**/?(*.)test.ts?(x)'],
  setupFilesAfterEnv: ['<rootDir>/src/scripts/jest-dbtest-setup.ts'],
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/scripts/**',
    '!src/**/*.d.ts'
  ]
};