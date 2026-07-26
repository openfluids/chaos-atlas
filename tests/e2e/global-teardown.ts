import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  EXPECTED_PATH,
  MAP_PAGES,
  MATRIX_JSON_PATH,
  MATRIX_JSONL_PATH,
  SAMPLE_COUNT,
  SETTLE_MS,
  type SweepExpectation,
} from './sweepConfig';
import { parseSweepJsonl, summarizeSweep } from './sweepSummary';

/**
 * After every worker has finished: if the sweep declared participation via the
 * expectation file, fold the durable jsonl into the matrix summary JSON and
 * assert the sweep verdict once per run.
 *
 * fullyParallel: true makes afterAll fire per worker on a partial matrix;
 * a trailing test has no guaranteed order. globalTeardown is the only hook
 * that sees the complete row set.
 *
 * When the expectation file is ABSENT, the sweep was not part of this run —
 * log and leave any prior matrix artifact untouched (other e2e specs share
 * these global hooks).
 */
export default async function globalTeardown(): Promise<void> {
  const expectedPath = path.join(process.cwd(), EXPECTED_PATH);
  const jsonlPath = path.join(process.cwd(), MATRIX_JSONL_PATH);
  const outPath = path.join(process.cwd(), MATRIX_JSON_PATH);

  if (!fs.existsSync(expectedPath)) {
    console.log(
      '[param-sweep] expectation file absent — sweep did not participate; ' +
        'skipping assert and leaving matrix artifact untouched'
    );
    return;
  }

  let expectation: SweepExpectation;
  try {
    expectation = JSON.parse(
      fs.readFileSync(expectedPath, 'utf8')
    ) as SweepExpectation;
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[param-sweep] expectation file present but unreadable: ${why}`
    );
  }

  const expectedPages =
    expectation.pages?.length > 0
      ? expectation.pages
      : MAP_PAGES.slice();

  if (!fs.existsSync(jsonlPath)) {
    throw new Error(
      `[param-sweep] expectation present but jsonl missing at ${jsonlPath} ` +
        '(sweep ran and persisted nothing)'
    );
  }

  const raw = fs.readFileSync(jsonlPath, 'utf8');
  // parseSweepJsonl throws on malformed lines with the offending line number.
  const rows = parseSweepJsonl(raw);

  const result = summarizeSweep(rows, { expectedPages });
  const summary = {
    sampleCount: expectation.sampleCount ?? SAMPLE_COUNT,
    settleMs: expectation.settleMs ?? SETTLE_MS,
    pages: expectedPages.slice(),
    generatedAt: new Date().toISOString(),
    rows,
    findings: result.findings,
    counts: result.counts,
    missingPages: result.missingPages,
    pass: result.pass,
    message: result.message,
  };
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

  console.log(
    `[param-sweep] matrix written to ${outPath} (` +
      `${rows.length} rows, findings=${result.findings.length}, pass=${result.pass})`
  );
  console.log(result.message);

  if (!result.pass) {
    throw new Error(
      `[param-sweep] sweep assertion failed:\n${result.message}`
    );
  }
}
