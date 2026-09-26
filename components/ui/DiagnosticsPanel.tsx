'use client';

import React, { useEffect, useRef, useState } from 'react';
import wasmPkg from '@/public/vendor/dynachaos-wasm/package.json';
import {
  DEFAULT_C_VALUES,
  MIN_N_D2,
  MIN_N_K,
  MIN_N_PE,
  ORDINAL_D,
  ORDINAL_TAU,
  THEILER_WINDOW,
  correlationDimensionFromCounts,
  correlationRadii,
  defaultNCut,
  medianKFromZeroOne,
  permutationEntropyFromOrdinal,
} from '@/lib/diagnostics';
import { diagnosticsWorkerUrl } from '@/lib/diagnostics/workerUrl';
import { useDrawnSeries } from '@/components/ui/DiagnosticsSeriesContext';

const ENGINE_LABEL = `computed by dynachaos-wasm ${wasmPkg.version}, the kernels of the dynachaos paper`;

const NO_SERIES = 'no time series in this view';

interface Report {
  token: string;
  d2?: number;
  pe?: number;
  k?: number;
}

function seriesToken(series: readonly number[]): string {
  let hash = series.length;
  const step = Math.max(1, Math.floor(series.length / 32));
  for (let i = 0; i < series.length; i += step) {
    hash = (Math.imul(hash, 131) + Math.round(series[i] * 1e6)) | 0;
  }
  hash = (Math.imul(hash, 131) + Math.round(series[series.length - 1] * 1e6)) | 0;
  return String(hash);
}

function formatMeasure(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : '—';
}

function tooShort(n: number): string {
  return `series too short (N = ${n})`;
}

function measureText(
  series: readonly number[] | null,
  wanted: boolean,
  value: number | undefined,
): string {
  if (series == null) return '—';
  if (!wanted) return tooShort(series.length);
  if (value === undefined) return '…';
  return formatMeasure(value);
}

/**
 * Computes D2, normalised permutation entropy, and 0-1 K of the series the
 * page is drawing. Kernels run in a module worker; this component only
 * post-processes the flat layouts. A measure below its measured MIN_N is
 * not sent to the worker.
 */
export function DiagnosticsPanel(): React.ReactElement {
  const drawn = useDrawnSeries();
  const series = drawn.series;
  const workerRef = useRef<Worker | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const n = series?.length ?? 0;
  const wantD2 = series != null && n >= MIN_N_D2;
  const wantPE = series != null && n >= MIN_N_PE;
  const wantK = series != null && n >= MIN_N_K;
  const token = series && (wantD2 || wantPE || wantK) ? seriesToken(series) : '';
  const live = report && report.token === token ? report : null;

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!series || token === '' || typeof Worker === 'undefined') return;
    const worker = workerRef.current ?? new Worker(diagnosticsWorkerUrl(), { type: 'module' });
    workerRef.current = worker;
    const request = token;
    const acc: { d2?: number; pe?: number; k?: number } = {};
    const onMessage = (event: MessageEvent) => {
      const data = event.data as {
        id?: string;
        measure?: string;
        ok?: boolean;
        values?: number[];
      };
      if (!data || data.id !== request || !data.ok || !data.values) return;
      if (data.measure === 'd2') acc.d2 = correlationDimensionFromCounts(data.values).d2;
      else if (data.measure === 'pe') acc.pe = permutationEntropyFromOrdinal(data.values, true);
      else if (data.measure === 'k') acc.k = medianKFromZeroOne(data.values);
      if ((wantD2 && acc.d2 === undefined) || (wantPE && acc.pe === undefined) || (wantK && acc.k === undefined)) {
        return;
      }
      setReport({ token: request, d2: acc.d2, pe: acc.pe, k: acc.k });
    };
    worker.addEventListener('message', onMessage);
    const payload = Array.from(series);
    if (wantD2) {
      worker.postMessage({
        id: request,
        series: payload,
        measure: 'd2',
        rValues: correlationRadii(series),
        theiler: THEILER_WINDOW,
      });
    }
    if (wantPE) {
      worker.postMessage({
        id: request,
        series: payload,
        measure: 'pe',
        d: ORDINAL_D,
        tau: ORDINAL_TAU,
      });
    }
    if (wantK) {
      worker.postMessage({
        id: request,
        series: payload,
        measure: 'k',
        cValues: DEFAULT_C_VALUES,
        nCut: defaultNCut(series.length),
      });
    }
    return () => {
      worker.removeEventListener('message', onMessage);
    };
  }, [series, token, wantD2, wantPE, wantK]);

  return (
    <section
      data-testid="diagnostics-panel"
      className="mt-6 rounded-lg border p-4"
      style={{
        borderColor: 'var(--border-primary)',
        backgroundColor: 'var(--bg-secondary)',
        color: 'var(--text-primary)',
      }}
    >
      <h2 className="text-lg font-semibold" style={{ color: 'var(--text-accent)' }}>
        Diagnostics
      </h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }} data-testid="diagnostics-label">
        {ENGINE_LABEL}
      </p>
      <p className="mt-1 text-sm font-mono" style={{ color: 'var(--text-primary)' }} data-testid="diagnostics-series">
        {series == null ? NO_SERIES : `N = ${n} · ${drawn.view}`}
      </p>
      <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt style={{ color: 'var(--text-secondary)' }}>D₂</dt>
          <dd className="font-mono" data-testid="diagnostics-d2">
            {measureText(series, wantD2, live?.d2)}
          </dd>
        </div>
        <div>
          <dt style={{ color: 'var(--text-secondary)' }}>Permutation entropy</dt>
          <dd className="font-mono" data-testid="diagnostics-pe">
            {measureText(series, wantPE, live?.pe)}
          </dd>
        </div>
        <div>
          <dt style={{ color: 'var(--text-secondary)' }}>0–1 test K</dt>
          <dd className="font-mono" data-testid="diagnostics-k">
            {measureText(series, wantK, live?.k)}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export default DiagnosticsPanel;
