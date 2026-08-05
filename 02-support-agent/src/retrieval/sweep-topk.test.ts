import { test } from 'node:test';
import assert from 'node:assert/strict';

import { corpusSearch } from './corpus.test-helper.ts';
import { PROBES } from './probes.ts';
import { formatSweep, loadProbes, sweep, SWEEP_VALUES } from './sweep-topk.ts';

test('B6: the sweep covers the values tasks.md names', () => {
  assert.deepEqual(SWEEP_VALUES, [3, 4, 6, 8, 12]);
});

// B6 — "Produces a table; the chosen k is a measurement"
test('B6: the sweep produces one measured row per k', async () => {
  const rows = await sweep(await corpusSearch());

  assert.equal(rows.length, SWEEP_VALUES.length);
  assert.deepEqual(rows.map((r) => r.k), SWEEP_VALUES);

  for (const row of rows) {
    for (const metric of ['hitRate', 'mrr', 'falseFloorRate', 'trueFloorRate'] as const) {
      assert.ok(row[metric] >= 0 && row[metric] <= 1, `${metric} at k=${row.k} is ${row[metric]}`);
    }
    assert.ok(row.meanTokens > 0);
  }
});

test('B6: recall rises with k and so does the token bill — that is the trade', async () => {
  const rows = await sweep(await corpusSearch());
  const first = rows[0];
  const last = rows[rows.length - 1];
  assert.ok(first && last);

  for (let i = 1; i < rows.length; i++) {
    const previous = rows[i - 1];
    const current = rows[i];
    assert.ok(previous && current);
    assert.ok(current.hitRate >= previous.hitRate, `hit rate is monotonic at k=${current.k}`);
    assert.ok(current.meanTokens > previous.meanTokens, `tokens grow at k=${current.k}`);
  }

  assert.ok(last.hitRate > first.hitRate, 'k=12 recalls more than k=3');
});

test('B6: k=6 is where recall stops paying for itself', async () => {
  const rows = await sweep(await corpusSearch(), PROBES);
  const at = (k: number) => rows.find((row) => row.k === k);

  const six = at(6);
  const twelve = at(12);
  assert.ok(six && twelve);

  assert.ok(six.hitRate >= 0.9, `k=6 hit rate is ${six.hitRate}`);
  assert.equal(six.trueFloorRate, 1, 'every out-of-corpus case is still caught');

  // One probe escalates that shouldn't: "how long does it take to reach hawaii". The
  // transit table writes it as "AK, HI", and no lexical measure bridges that — this is
  // the case a real embedding provider is for. 1 in 25 is inside spec.md A4's 15% bound,
  // and it fails in the safe direction (spec.md §7.3).
  assert.ok(six.falseFloorRate <= 0.05, `false below-floor at k=6 is ${six.falseFloorRate}`);

  assert.ok(
    twelve.hitRate - six.hitRate <= 0.1,
    `doubling k buys ${((twelve.hitRate - six.hitRate) * 100).toFixed(0)} points of recall ` +
      `for ${Math.round(twelve.meanTokens - six.meanTokens)} extra tokens`,
  );
});

test('B6: the table is markdown a human can read', async () => {
  const rows = await sweep(await corpusSearch(), PROBES, [3, 6]);
  const table = formatSweep(rows, 'unit test');

  assert.match(table, /\| k \| hit rate \|/);
  assert.match(table, /^\| 3 \|/m);
  assert.match(table, /^\| 6 \|/m);
  assert.match(table, /unit test/);
});

test('B6: it sweeps the eval dataset when there is one, and the probes when there is not', async () => {
  const { probes, source } = await loadProbes();

  assert.ok(probes.length > 0);
  assert.ok(probes.every((probe) => typeof probe.question === 'string' && probe.question !== ''));
  assert.match(source, /evals\/dataset\.json|retrieval probes/);
});
