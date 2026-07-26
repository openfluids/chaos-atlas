import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  EXPECTED_PATH,
  MATRIX_JSONL_PATH,
} from './sweepConfig';

/**
 * Truncate the durable param-sweep matrix and clear the run-scoped expectation
 * once per Playwright run.
 * Must not live in beforeAll: a worker restart would wipe rows already written.
 * The expectation file is re-created only if the sweep spec module loads.
 */
export default async function globalSetup(): Promise<void> {
  const jsonlPath = path.join(process.cwd(), MATRIX_JSONL_PATH);
  const expectedPath = path.join(process.cwd(), EXPECTED_PATH);
  fs.mkdirSync(path.dirname(jsonlPath), { recursive: true });
  fs.writeFileSync(jsonlPath, '');
  try {
    fs.unlinkSync(expectedPath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') throw err;
  }
}
