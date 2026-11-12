import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSnapshot } from './update-stars.mjs';

test('snapshot handles inconsistent API totals without inventing daily stars', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  let reads = 0;
  let historyCount = 1;
  globalThis.fetch = async url => {
    let body;
    if (url.includes('/stargazers/history')) {
      reads++;
      body = [{ week: 1789862400, days: [historyCount] }];
    } else if (url.includes('/issues?')) body = [{}, { pull_request: {} }];
    else body = { stargazers_count: 2, forks_count: 3 };
    return { ok: true, json: async () => body };
  };
  const snapshot = await buildSnapshot({ pause: async () => {} });
  assert.equal(reads, 3);
  assert.equal(snapshot.stars, 2);
  assert.equal(snapshot.history_total, 1);
  assert.equal(snapshot.history_difference, 1);
  assert.equal(snapshot.daily.reduce((sum, p) => sum + p.count, 0), 1);
  assert.equal(snapshot.open_issues, 1);

  reads = 0;
  await buildSnapshot({ pause: async () => { historyCount = 2; } });
  assert.equal(reads, 2, 'stops retrying once sources agree');

  globalThis.fetch = async () => ({ ok: false, status: 403, text: async () => 'Forbidden' });
  await assert.rejects(buildSnapshot(), /GitHub API 403/);

  globalThis.fetch = async url => ({ ok: true, json: async () => url.includes('/stargazers/history') || url.includes('/issues?') ? [] : {} });
  await assert.rejects(buildSnapshot(), /returned no dates/);
});
