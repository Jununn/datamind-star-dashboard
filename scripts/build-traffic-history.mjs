import { readdir, readFile, writeFile } from 'node:fs/promises';

// Add new snapshots as separate files; rebuild without replacing older snapshots.
const files = (await readdir('data')).filter(name => /^traffic-\d{8}-\d{8}\.json$/.test(name)).sort();
const snapshots = await Promise.all(files.map(async name => JSON.parse(await readFile(`data/${name}`, 'utf8'))));
for (const snapshot of snapshots) {
  if (!snapshot.days.length || snapshot.metrics.some(metric => metric.values.length !== snapshot.days.length)) {
    throw new Error(`Invalid traffic snapshot: ${snapshot.startDate}`);
  }
}
await writeFile('data/traffic-history.js', `window.DATAMIND_TRAFFIC_SNAPSHOTS = ${JSON.stringify(snapshots, null, 2)};\n`);
