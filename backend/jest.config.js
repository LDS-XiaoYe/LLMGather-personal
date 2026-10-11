const path = require('path');

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: 'src/.*\\.spec\\.ts$',
  transform: {
    '^.+\\.js$': '<rootDir>/jest-js-transformer.cjs',
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: path.join(__dirname, 'tsconfig.spec.json'),
    }],
  },
  transformIgnorePatterns: ['/node_modules/(?!uuid/)'],
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
};
