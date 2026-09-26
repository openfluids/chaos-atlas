'use client';

import React, { useEffect, useRef, useState } from 'react';
import wasmPkg from '@/public/vendor/dynachaos-wasm/package.json';
import {
  DEFAULT_C_VALUES,
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

interface Report {
  token: string;
  d2: number;
  pe: number;
  k: number;
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

/**
 * Computes D2, normalised permutation entropy, and 0-1 K of the series the
 * page is drawing. Kernels run in a module worker; this component only
 * post-processes the flat layouts.
 */
export function DiagnosticsPanel(): React.ReactElement {
  const series = useDrawnSeries();
  const workerRef = useRef<Worker | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const token = series && series.length >= 3 ? seriesToken(series) : '';
  const live = report && report.token === token ? report : null;

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!series || series.length < 3 || typeof Worker === 'undefined') return;
    const worker = workerRef.current ?? new Worker(diagnosticsWorkerUrl(), { type: 'module' });
    workerRef.current = worker;
    const request = seriesToken(series);
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
      if (acc.d2 === undefined || acc.pe === undefined || acc.k === undefined) return;
      setReport({ token: request, d2: acc.d2, pe: acc.pe, k: acc.k });
    };
    worker.addEventListener('message', onMessage);
    const radii = correlationRadii(series);
    const payload = Array.from(series);
    worker.postMessage({
      id: request,
      series: payload,
      measure: 'd2',
      rValues: radii,
      theiler: THEILER_WINDOW,
    });
    worker.postMessage({
      id: request,
      series: payload,
      measure: 'pe',
      d: ORDINAL_D,
      tau: ORDINAL_TAU,
    });
    worker.postMessage({
      id: request,
      series: payload,
      measure: 'k',
      cValues: DEFAULT_C_VALUES,
      nCut: defaultNCut(series.length),
    });
    return () => {
      worker.removeEventListener('message', onMessage);
    };
  }, [series]);

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
      <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt style={{ color: 'var(--text-secondary)' }}>D₂</dt>
          <dd className="font-mono" data-testid="diagnostics-d2">
            {live ? formatMeasure(live.d2) : series && series.length >= 3 ? '…' : '—'}
          </dd>
        </div>
        <div>
          <dt style={{ color: 'var(--text-secondary)' }}>Permutation entropy</dt>
          <dd className="font-mono" data-testid="diagnostics-pe">
            {live ? formatMeasure(live.pe) : series && series.length >= 3 ? '…' : '—'}
          </dd>
        </div>
        <div>
          <dt style={{ color: 'var(--text-secondary)' }}>0–1 test K</dt>
          <dd className="font-mono" data-testid="diagnostics-k">
            {live ? formatMeasure(live.k) : series && series.length >= 3 ? '…' : '—'}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export default DiagnosticsPanel;
