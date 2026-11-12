import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSnapshot, preserveHistory } from './update-stars.mjs';

test('keeps completed dates, only increases the partial day, and appends dates', () => {
  const previous = { fetched_at: '2026-11-11T14:00:00Z', daily: [
    { date: '2026-11-09', count: 8 },
    { date: '2026-11-10', count: 4 },
    { date: '2026-11-11', count: 2 }
  ] };
  const incoming = [
    { date: '2026-11-10', count: 9 },
    { date: '2026-11-11', count: 1 },
    { date: '2026-11-12', count: 3 }
  ];
  const expected = [...previous.daily, incoming[2]];
  assert.deepEqual(preserveHistory(previous, incoming), expected);
  assert.deepEqual(preserveHistory(previous, [...incoming, { date: '2026-11-11', count: 5 }])[2],
    { date: '2026-11-11', count: 5 });
  assert.deepEqual(preserveHistory({ ...previous, daily: expected }, incoming), expected);
  assert.equal(previous.daily.length, 3, 'does not mutate the stored snapshot');
});

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
