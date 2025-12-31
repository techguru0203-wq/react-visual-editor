/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
    }],
  },
  moduleNameMapper: {
    '^node-fetch$': 'node-fetch/lib/index.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(node-fetch)/)',
  ],
};

module.exports = config; 