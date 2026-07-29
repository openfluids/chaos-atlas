/**
 * Invariant: chartHelpersMock must surface every export of the real
 * chartHelpers module.
 *
 * What this does and does not buy. Because the mock now spreads the real
 * module, a *missing* key is impossible by construction — so this test cannot
 * fail on a newly added export. What it does guard is the approach itself: go
 * back to hand-listing exports and it fails immediately.
 *
 * It does NOT prove a new export is USABLE under the stub. A DOM-touching
 * export that nobody added to the overrides is present here, yet throws from
 * inside the real helper the first time a suite reaches it. Covering that needs
 * a call-each-export check, which is not what this asserts.
 */
jest.mock('d3', () => require('./mockVizDeps').d3Mock);

import { chartHelpersMock } from './mockVizDeps';

const chartHelpersActual = jest.requireActual(
  '@/components/visualizations/chartHelpers',
) as Record<string, unknown>;

describe('chartHelpersMock export coverage', () => {
  it('defines every key exported by the real chartHelpers module', () => {
    const missing: string[] = [];
    for (const key of Object.keys(chartHelpersActual)) {
      if ((chartHelpersMock as Record<string, unknown>)[key] === undefined) {
        missing.push(key);
      }
    }
    expect(missing).toEqual([]);
  });
});
