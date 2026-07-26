import {
  parseSweepJsonl,
  summarizeSweep,
  type SweepMatrixRow,
} from '../e2e/sweepSummary';

const ALL_PAGES = [
  '/maps/arnold',
  '/maps/bakers',
  '/maps/complex',
  '/maps/duffing',
  '/maps/henon',
  '/maps/ikeda',
  '/maps/logistic',
  '/maps/standard',
  '/maps/tent',
  '/maps/tinkerbell',
  '/cml/diffusive',
] as const;

function row(
  partial: Partial<SweepMatrixRow> & Pick<SweepMatrixRow, 'verdict'>
): SweepMatrixRow {
  return {
    page: partial.page ?? '/maps/henon',
    param: partial.param ?? 'Parameter a',
    value: partial.value ?? 1.0,
    verdict: partial.verdict,
    detail: partial.detail,
  };
}

/** One ok row per page — minimal complete matrix. */
function completeOkRows(
  pages: readonly string[] = ALL_PAGES
): SweepMatrixRow[] {
  return pages.map((page) => row({ page, verdict: 'ok' }));
}

describe('summarizeSweep', () => {
  it('fails when any blank_no_notice row is present', () => {
    const rows: SweepMatrixRow[] = [
      row({ verdict: 'ok' }),
      row({
        verdict: 'blank_no_notice',
        value: 0.5,
        detail: 'canvas empty; no orbit-escape-notice',
      }),
      row({ verdict: 'blank_with_notice', value: 2 }),
    ];
    const s = summarizeSweep(rows);
    expect(s.pass).toBe(false);
    expect(s.counts.blank_no_notice).toBe(1);
    expect(s.blankNoNotice).toHaveLength(1);
    expect(s.message).toMatch(/blank_no_notice/);
    expect(s.message).toMatch(/FAIL/);
  });

  it('passes when only ok and blank_with_notice are present', () => {
    const rows: SweepMatrixRow[] = [
      row({ verdict: 'ok', value: 0.1 }),
      row({ verdict: 'ok', value: 0.2 }),
      row({
        verdict: 'blank_with_notice',
        value: 1.8,
        detail: 'canvas empty; orbit-escape-notice present',
      }),
    ];
    const s = summarizeSweep(rows);
    expect(s.pass).toBe(true);
    expect(s.counts.blank_no_notice ?? 0).toBe(0);
    expect(s.counts.blank_with_notice).toBe(1);
    expect(s.message).toMatch(/PASS/);
    expect(s.message).not.toMatch(/^FAIL/m);
  });

  it('passes on degenerate alone but names it in the message', () => {
    const rows: SweepMatrixRow[] = [
      row({
        verdict: 'degenerate',
        value: 0.5,
        detail: 'canvas paint collapsed (nonZero≈1)',
      }),
    ];
    const s = summarizeSweep(rows);
    expect(s.pass).toBe(true);
    expect(s.counts.degenerate).toBe(1);
    expect(s.degenerate).toHaveLength(1);
    expect(s.message).toMatch(/degenerate/);
    expect(s.message).toMatch(/not failing this cycle/);
    expect(s.message).toMatch(/Parameter a/);
  });

  it('counts and findings exclude only ok from findings list', () => {
    const rows: SweepMatrixRow[] = [
      row({ verdict: 'ok' }),
      row({ verdict: 'blank_with_notice' }),
      row({ verdict: 'degenerate' }),
    ];
    const s = summarizeSweep(rows);
    expect(s.findings).toHaveLength(2);
    expect(s.counts).toEqual({
      ok: 1,
      blank_with_notice: 1,
      degenerate: 1,
    });
    expect(s.pass).toBe(true);
  });

  it('fails on zero rows when expectedPages are declared', () => {
    const s = summarizeSweep([], { expectedPages: ALL_PAGES });
    expect(s.pass).toBe(false);
    expect(s.missingPages).toEqual([...ALL_PAGES]);
    expect(s.message).toMatch(/zero rows/i);
    expect(s.message).toMatch(/FAIL/);
  });

  it('fails naming each missing page when the matrix is incomplete', () => {
    const rows = completeOkRows(['/maps/arnold', '/maps/henon']);
    const s = summarizeSweep(rows, { expectedPages: ALL_PAGES });
    expect(s.pass).toBe(false);
    expect(s.missingPages).toContain('/maps/bakers');
    expect(s.missingPages).toContain('/cml/diffusive');
    expect(s.missingPages).not.toContain('/maps/arnold');
    expect(s.missingPages).not.toContain('/maps/henon');
    expect(s.message).toMatch(/missing pages/);
    expect(s.message).toMatch(/\/maps\/bakers/);
    expect(s.message).toMatch(/\/cml\/diffusive/);
  });

  it('passes when all expected pages are present with only ok/blank_with_notice', () => {
    const rows: SweepMatrixRow[] = [
      ...completeOkRows(ALL_PAGES),
      row({
        page: '/maps/henon',
        verdict: 'blank_with_notice',
        value: 2,
        detail: 'canvas empty; orbit-escape-notice present',
      }),
    ];
    const s = summarizeSweep(rows, { expectedPages: ALL_PAGES });
    expect(s.pass).toBe(true);
    expect(s.missingPages).toEqual([]);
    expect(s.message).toMatch(/PASS/);
    expect(s.message).not.toMatch(/^FAIL/m);
  });

  it('passes on degenerate alone when its page is among expectedPages', () => {
    const pages = ['/maps/henon'] as const;
    const rows: SweepMatrixRow[] = [
      row({
        page: '/maps/henon',
        verdict: 'degenerate',
        value: 0.5,
        detail: 'canvas paint collapsed (nonZero≈1)',
      }),
    ];
    const s = summarizeSweep(rows, { expectedPages: pages });
    expect(s.pass).toBe(true);
    expect(s.missingPages).toEqual([]);
    expect(s.message).toMatch(/degenerate/);
    expect(s.message).toMatch(/not failing this cycle/);
  });
});

describe('parseSweepJsonl', () => {
  it('returns empty array for empty input', () => {
    expect(parseSweepJsonl('')).toEqual([]);
    expect(parseSweepJsonl('   \n  ')).toEqual([]);
  });

  it('parses well-formed lines', () => {
    const line = JSON.stringify(row({ verdict: 'ok', value: 0.3 }));
    const rows = parseSweepJsonl(line + '\n' + line);
    expect(rows).toHaveLength(2);
    expect(rows[0].verdict).toBe('ok');
  });

  it('throws with the 1-based line number on a malformed line', () => {
    const good = JSON.stringify(row({ verdict: 'ok' }));
    const raw = `${good}\n{oops\n${good}`;
    expect(() => parseSweepJsonl(raw)).toThrow(/line 2/);
    expect(() => parseSweepJsonl(raw)).toThrow(/malformed jsonl/);
  });
});
