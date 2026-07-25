// ESLint 10 flat config. Replaces .eslintrc.json, which the eslintrc format no
// longer supports, and `next lint`, which Next 16 removed in favour of running
// eslint directly.
//
// eslint-config-next 16 already ships native flat-config arrays, so no
// FlatCompat shim is needed.
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

const config = [
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
    // eslint-config-next sets settings.react.version to 'detect', which makes
    // eslint-plugin-react call resolveBasedir(context) -> context.getFilename().
    // ESLint 10 removed getFilename, so detection throws inside every rule that
    // consults the React version and the whole run dies. Pinning the version
    // skips detection entirely; it is also faster and deterministic, so this is
    // the right setting regardless of ESLint version.
    settings: { react: { version: '19.2' } },
  },

  {
    // `next lint` only ever covered app/, components/, lib/ and pages/, so test
    // files are being linted here for the first time. Mock factories passed to
    // jest.mock are anonymous by design and never render in a devtools tree.
    files: ['tests/**/*.{ts,tsx}', 'jest.setup.js'],
    rules: {
      'react/display-name': 'off',
      'import/no-anonymous-default-export': 'off',
    },
  },

  {
    // Enabled standalone rather than by adopting eslint-config-next/typescript
    // wholesale, which would also surface ~111 pre-existing errors unrelated
    // to unused variables.
    files: ['**/*.{ts,tsx}'],
    ignores: [
      // Deliberately-dead code implementing pan/zoom and a DPI-correct plot
      // exporter, kept as-is for a later phase to wire in. Not held to this
      // rule so it doesn't have to be edited to satisfy it.
      'components/ui/ExportControls.tsx',
      'lib/export/plot-export.ts',
      'hooks/usePlotTransform.ts',
      'components/visualizations/InteractiveSVG.tsx',
    ],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  {
    // React Compiler diagnostics, from eslint-config-next 16. All 55 findings
    // have been resolved, so these are errors: the codebase is clean and should
    // stay that way. The single justified exception is the hydration guard in
    // theme-switcher.tsx, disabled inline with its reasoning.
    files: ['**/*.{ts,tsx}'],
    rules: {
      'react-hooks/immutability': 'error',
      'react-hooks/set-state-in-effect': 'error',
      'react-hooks/refs': 'error',
      'react-hooks/use-memo': 'error',
      'react-hooks/preserve-manual-memoization': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];

export default config;
