import { readFile, readdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

export const publicFiles = ['index.html', 'public.js', 'access-gate.js', 'access-gate.css', 'styles.css', 'dataflex-theme.css', 'favicon.ico', 'favicon.png', 'apple-touch-icon.png', '.nojekyll', 'data/stars.json', 'data/stars.js', 'encrypted/dashboard.js'];
const forbiddenPaths = /^(app\.js|data\/(?!stars\.(json|js)$)|\.private|backups\/)/;
const forbiddenContent = [/DATAMIND_NETWORK_SNAPSHOT/, /DATAMIND_REGIONS_SNAPSHOT/, /DATAMIND_TRAFFIC_SNAPSHOTS/, /const promotionActions/, /keyring/, /gh[pousr]_[a-zA-Z0-9]{20}/];
export async function verify(root = '.') {
  for (const file of publicFiles) {
    await stat(`${root}/${file}`);
    if (/\.(js|json|html)$/.test(file) && !file.startsWith('encrypted/')) {
      const text = await readFile(`${root}/${file}`, 'utf8');
      if (forbiddenContent.some(pattern => pattern.test(text))) throw new Error(`Plaintext leak in ${file}`);
    }
  }
  const html = await readFile(`${root}/index.html`, 'utf8');
  for (const marker of ['id="visitor-star"', 'id="regions"', 'id="traffic"', 'id="network"', 'id="calendar"', 'lockedContent']) {
    if (html.includes(marker)) throw new Error('Protected markup in public page');
  }
  const vault = await readFile(`${root}/encrypted/dashboard.js`, 'utf8');
  const envelope = JSON.parse(vault.slice(vault.indexOf('=') + 1).trim().replace(/;$/, ''));
  if (envelope.version !== 1 || envelope.iterations !== 600000 || !envelope.ciphertext) throw new Error('Invalid vault');
}
if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/verify-public.mjs')) {
  await verify();
  const safeDirectory = resolve('.').replaceAll('\\', '/');
  const tracked = execFileSync('git', ['-c', `safe.directory=${safeDirectory}`, 'ls-files'], { encoding: 'utf8' }).trim().split(/\r?\n/);
  if (tracked.some(name => forbiddenPaths.test(name))) throw new Error('Protected plaintext remains in tracked source tree');
  console.log('Public allowlist and tracked source leak checks passed.');
}
