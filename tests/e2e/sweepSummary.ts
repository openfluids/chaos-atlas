/**
 * Pure parameter-sweep matrix summariser.
 * No Playwright imports — unit-testable from tests/unit/.
 */

export type SweepVerdictKind =
  | 'ok'
  | 'pageerror'
  | 'unmounted'
  | 'blank_no_notice'
  | 'degenerate'
  | 'blank_with_notice';

export type SweepMatrixRow = {
  page: string;
  param: string;
  value: number;
  verdict: SweepVerdictKind;
  detail?: string;
};

export type SummarizeSweepOptions = {
  /** When set, the run fails if rows are empty or any listed page has no row. */
  expectedPages?: readonly string[];
};

export type SweepSummary = {
  counts: Record<string, number>;
  findings: SweepMatrixRow[];
  /** Rows that fail the run (unexplained blank plots). */
  blankNoNotice: SweepMatrixRow[];
  /** Degenerate paints — reported but not a failure this cycle. */
  degenerate: SweepMatrixRow[];
  /** Pages listed in expectedPages with zero rows in the matrix. */
  missingPages: string[];
  /**
   * false when blank_no_notice > 0, when rows are empty under expectedPages,
   * or when any expected page is missing. blank_with_notice and degenerate
   * never fail alone.
   */
  pass: boolean;
  message: string;
};

function countByVerdict(rows: SweepMatrixRow[]): Record<string, number> {
  return rows.reduce(
    (acc, r) => {
      acc[r.verdict] = (acc[r.verdict] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
}

function formatRow(r: SweepMatrixRow): string {
  const detail = r.detail ? ` (${r.detail})` : '';
  return `${r.page} | ${r.param} = ${r.value} → ${r.verdict}${detail}`;
}

/**
 * Parse durable jsonl into matrix rows. Malformed lines fail with the
 * 1-based line number — never silently become zero rows.
 */
export function parseSweepJsonl(raw: string): SweepMatrixRow[] {
  if (!raw.trim()) return [];
  const lines = raw.split('\n');
  const rows: SweepMatrixRow[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line) as SweepMatrixRow);
    } catch (err) {
      const why = err instanceof Error ? err.message : String(err);
      throw new Error(
        `[param-sweep] malformed jsonl at line ${i + 1}: ${why}`
      );
    }
  }
  return rows;
}

/**
 * Compute counts, findings, and pass/fail from matrix rows.
 *
 * Rule: blank_no_notice > 0 fails. blank_with_notice is correct behaviour
 * (explained divergence) and never fails. degenerate is reported in the
 * message but does not fail on its own this cycle.
 *
 * Completeness (when `expectedPages` is provided): empty matrix fails;
 * any expected page with no row fails and is named.
 */
export function summarizeSweep(
  rows: SweepMatrixRow[],
  options: SummarizeSweepOptions = {}
): SweepSummary {
  const counts = countByVerdict(rows);
  const findings = rows.filter((r) => r.verdict !== 'ok');
  const blankNoNotice = rows.filter((r) => r.verdict === 'blank_no_notice');
  const degenerate = rows.filter((r) => r.verdict === 'degenerate');

  const expectedPages = options.expectedPages;
  const missingPages: string[] = [];
  if (expectedPages && expectedPages.length > 0) {
    const present = new Set(rows.map((r) => r.page));
    for (const page of expectedPages) {
      if (!present.has(page)) missingPages.push(page);
    }
  }

  const emptyWhenExpected =
    expectedPages !== undefined && expectedPages.length > 0 && rows.length === 0;
  const incomplete = missingPages.length > 0;
  const pass =
    blankNoNotice.length === 0 && !emptyWhenExpected && !incomplete;

  const parts: string[] = [];
  parts.push(
    `rows=${rows.length} findings=${findings.length} counts=${JSON.stringify(counts)}`
  );

  if (emptyWhenExpected) {
    parts.push(
      'FAIL: zero rows but expected pages were declared (no evidence is not clean evidence)'
    );
  }

  if (incomplete) {
    parts.push(
      `FAIL: missing pages (${missingPages.length}): ${missingPages.join(', ')}`
    );
  }

  if (blankNoNotice.length > 0) {
    parts.push(
      `FAIL: blank_no_notice=${blankNoNotice.length} (unexplained blank plot):`
    );
    for (const r of blankNoNotice) {
      parts.push(`  ${formatRow(r)}`);
    }
  } else if (!emptyWhenExpected && !incomplete) {
    parts.push('PASS: no blank_no_notice rows');
  }

  if (degenerate.length > 0) {
    parts.push(
      `NOTE: degenerate=${degenerate.length} (reported, not failing this cycle):`
    );
    for (const r of degenerate) {
      parts.push(`  ${formatRow(r)}`);
    }
  }

  return {
    counts,
    findings,
    blankNoNotice,
    degenerate,
    missingPages,
    pass,
    message: parts.join('\n'),
  };
}
