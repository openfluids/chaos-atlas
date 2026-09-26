/**
 * Module worker: wasm kernels only. Post-processing stays in lib/diagnostics
 * so the page thread never runs the O(N^2) pair counts.
 *
 * Message: { id, series, measure, rValues?, theiler?, cValues?, nCut?, d?, tau? }
 * measure is "d2" | "pe" | "k". Reply: { id, measure, ok, values } where
 * values is the kernel's flat layout (header + payload).
 */
import init, {
  correlation_counts,
  ordinal_distribution,
  zero_one_k,
} from './vendor/dynachaos-wasm/dynachaos_wasm.js';

const ready = init();

self.onmessage = async (event) => {
  const msg = event.data ?? {};
  const id = msg.id;
  const measure = msg.measure;
  try {
    await ready;
    const series = new Float64Array(msg.series ?? []);
    let values;
    if (measure === 'd2') {
      values = correlation_counts(
        series,
        1,
        new Float64Array(msg.rValues ?? []),
        msg.theiler ?? 0,
        true,
      );
    } else if (measure === 'pe') {
      values = ordinal_distribution(series, msg.d ?? 5, msg.tau ?? 1);
    } else if (measure === 'k') {
      values = zero_one_k(
        series,
        new Float64Array(msg.cValues ?? []),
        msg.nCut ?? 2,
      );
    } else {
      throw new Error(`unknown measure ${measure}`);
    }
    self.postMessage({
      id,
      measure,
      ok: true,
      values: Array.from(values),
    });
  } catch (err) {
    self.postMessage({
      id,
      measure,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
