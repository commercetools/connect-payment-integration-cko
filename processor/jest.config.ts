/** @type {import('ts-jest').JestConfigWithTsJest} */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['./test/jest.setup.ts'],
  roots: ['./test'],
  moduleNameMapper: {
    '^@lib/(.*)$': '<rootDir>/src/libs/$1',
    '^@app/(.*)$': '<rootDir>/src/$1',
  },
};
