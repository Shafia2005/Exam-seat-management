// Unit tests for pure server and library code. `next/jest` compiles TypeScript
// with SWC and applies the `@/` path alias from tsconfig.json.
const nextJest = require('next/jest')

const createJestConfig = nextJest({ dir: './' })

module.exports = createJestConfig({
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/unit'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
})
