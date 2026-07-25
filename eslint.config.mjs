// ESLint 10 flat config. Replaces .eslintrc.json, which the eslintrc format no
// longer supports, and `next lint`, which Next 16 removed in favour of running
// eslint directly.
//
// eslint-config-next 16 already ships native flat-config arrays, so no
// FlatCompat shim is needed.
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

export default [
  {
    ignores: [
      '.next/**',
      'out/**',
      'coverage/**',
      'node_modules/**',
      'python/**',
      '.jest-cache/**',
      'next-env.d.ts',
    ],
  },
  // Scope matches the previous .eslintrc.json, which extended core-web-vitals
  // only. Adding eslint-config-next/typescript on top turns on rules this
  // codebase has never been held to (111 errors, mostly no-require-imports in
  // jest.mock calls); that is a separate decision from upgrading packages.
  ...nextCoreWebVitals,

  {
    // `next lint` only ever covered app/, components/, lib/ and pages/, so test
    // files are being linted here for the first time. Mock factories passed to
    // jest.mock are anonymous by design and never render in a devtools tree.
    files: ['tests/**/*.{ts,tsx}', 'jest.setup.js'],
    rules: {
      'react/display-name': 'off',
      'import/no-anonymous-default-export': 'off',
      // jest.setup.js stubs next/image with a plain <img> so jsdom can render it.
      // The stub never reaches a user, so the image rules do not apply.
      '@next/next/no-img-element': 'off',
      'jsx-a11y/alt-text': 'off',
    },
  },

  {
    // React Compiler diagnostics, new in eslint-config-next 16. They report 55
    // findings in the visualization components — real patterns, but resolving
    // them means restructuring how those components build their D3 scenes, which
    // is a refactor rather than a dependency upgrade. Kept visible as warnings
    // so the upgrade does not silently raise the bar CI enforces; promote to
    // 'error' once the components have been reworked.
    files: ['**/*.{ts,tsx}'],
    rules: {
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/use-memo': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
];
