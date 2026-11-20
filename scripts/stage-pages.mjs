import { mkdir, copyFile, readdir } from 'node:fs/promises';
import { publicFiles, verify } from './verify-public.mjs';

const destination = '.private/pages';
try { if ((await readdir(destination)).length) throw new Error('Pages staging directory must be empty'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
await verify();
for (const name of publicFiles) {
  await mkdir(`${destination}/${name.split('/').slice(0, -1).join('/')}`, { recursive: true });
  await copyFile(name, `${destination}/${name}`);
}
await verify(destination);
console.log('Pages artifact contains only allowlisted public assets and ciphertext.');
