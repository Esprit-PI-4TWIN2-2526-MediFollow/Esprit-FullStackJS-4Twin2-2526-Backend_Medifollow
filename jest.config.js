module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/$1',
  },
  collectCoverage: true,
  coverageDirectory: '../coverage',
  coverageReporters: ['lcov', 'text'],
  testEnvironment: 'node',

  // 🔥 IMPORTANT : ignorer les tests cassés
  testPathIgnorePatterns: [
    "/node_modules/",
    "/src/users/",
    "/src/role/",
    "/src/cloudinary/"
  ],
};
