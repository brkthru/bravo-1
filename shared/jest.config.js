module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+.tsx?$': ['@swc/jest', {}]
  },
  rootDir: __dirname,
  testMatch: ['**/?(*.)test.{ts,tsx}'],
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.ts'
  ]
};