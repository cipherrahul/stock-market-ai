module.exports = {
  projects: [
    {
      displayName: 'auth-service',
      testMatch: ['<rootDir>/services/auth-service/**/*.test.ts'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: '.',
      collectCoverageFrom: [
        'services/auth-service/src/**/*.ts',
        '!services/auth-service/src/**/*.d.ts',
        '!services/auth-service/src/index.ts',
      ],
      coverageThreshold: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    {
      displayName: 'api-gateway',
      testMatch: ['<rootDir>/apps/gateway/**/*.test.ts'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: '.',
      collectCoverageFrom: [
        'apps/gateway/src/**/*.ts',
        '!apps/gateway/src/**/*.d.ts',
        '!apps/gateway/src/index.ts',
      ],
      coverageThreshold: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },
    {
      displayName: 'portfolio-service',
      testMatch: ['<rootDir>/services/portfolio-service/**/*.test.ts'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: '.',
      collectCoverageFrom: [
        'services/portfolio-service/src/**/*.ts',
        '!services/portfolio-service/src/**/*.d.ts',
        '!services/portfolio-service/src/index.ts',
      ],
      coverageThreshold: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    {
      displayName: 'trading-engine',
      testMatch: ['<rootDir>/services/trading-engine-service/**/*.test.ts'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: '.',
      collectCoverageFrom: [
        'services/trading-engine-service/src/**/*.ts',
        '!services/trading-engine-service/src/**/*.d.ts',
        '!services/trading-engine-service/src/index.ts',
      ],
      coverageThreshold: {
        global: {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
    },
  ],
  collectCoverageFrom: [
    'services/*/src/**/*.ts',
    'apps/*/src/**/*.ts',
    'packages/*/src/**/*.ts',
    '!**/*.d.ts',
    '!**/index.ts',
  ],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  globals: {
    'ts-jest': {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    },
  },
};
