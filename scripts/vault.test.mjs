import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seal, open } from './vault.mjs';

test('authenticated compressed vault round-trips without leaking plaintext', async () => {
  const files = { 'index.html': '<h1>Private report 私密报告</h1>', 'data/report.json': '{"visitors":123}' };
  const password = 'test-only-random-fixture';
  const a = await seal(files, password);
  assert.deepEqual(await open(a, password), files);
  assert.ok(!JSON.stringify(a).includes('Private report'));
  await assert.rejects(open(a, 'wrong'));
  await assert.rejects(open({ ...a, ciphertext: 'AAAA' + a.ciphertext.slice(4) }, password));
  await assert.rejects(open({ ...a, salt: Buffer.alloc(32, 9).toString('base64') }, password));
  const b = await seal(files, password, a);
  assert.equal(a.salt, b.salt, 'remembered keys survive data refreshes');
  assert.notEqual(a.iv, b.iv, 'each encryption uses a fresh nonce');
  assert.notEqual(a.ciphertext, b.ciphertext);
  assert.deepEqual(await open(b, password), files);
});
