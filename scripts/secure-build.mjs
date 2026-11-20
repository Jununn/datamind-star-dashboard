import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { seal, open } from './vault.mjs';

const source = '.private/source';
const bundlePath = 'encrypted/dashboard.js';
const read = path => readFile(path, 'utf8');
const parseBundle = text => JSON.parse(text.slice(text.indexOf('=') + 1).trim().replace(/;$/, ''));
const loadVault = async () => parseBundle(await read(bundlePath));
async function collect(dir, prefix = '') {
  const files = {};
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) Object.assign(files, await collect(`${dir}/${entry.name}`, `${name}/`));
    else files[name] = await read(`${dir}/${entry.name}`);
  }
  return files;
}
if (process.argv[2] === 'decrypt') {
  const files = await open(await loadVault(), process.env.DASHBOARD_PASSWORD);
  for (const [name, content] of Object.entries(files)) {
    if (!/^(index\.html|app\.js|styles\.css|dataflex-theme\.css|data\/[a-zA-Z0-9.-]+)$/.test(name)) throw new Error('Unsafe vault path');
    await mkdir(`${source}/${name.split('/').slice(0, -1).join('/')}`, { recursive: true });
    await writeFile(`${source}/${name}`, content);
  }
} else if (process.argv[2] === 'encrypt') {
  const files = await collect(source);
  let previous;
  try { previous = await loadVault(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previous) await open(previous, process.env.DASHBOARD_PASSWORD); // A wrong Secret must never overwrite the vault.
  const vault = await seal(files, process.env.DASHBOARD_PASSWORD, previous);
  const restored = await open(vault, process.env.DASHBOARD_PASSWORD);
  if (JSON.stringify(restored) !== JSON.stringify(files)) throw new Error('Round-trip verification failed');
  await mkdir('encrypted', { recursive: true });
  await writeFile(bundlePath, `window.DASHBOARD_VAULT = ${JSON.stringify(vault)};\n`);
  // Only the pre-gate markup and explicitly public Star snapshot are published.
  let html = files['index.html'];
  const boundary = html.indexOf('        <section class="panel" id="visitor-star">');
  if (boundary < 0) throw new Error('Missing protection boundary');
  html = html.slice(0, boundary) + await read('scripts/public-tail.html');
  html = html.replace('</head>', '    <link rel="stylesheet" href="./access-gate.css?v=encrypted-1" />\n  </head>');
  await writeFile('index.html', html);
  await mkdir('data', { recursive: true });
  for (const name of ['stars.json', 'stars.js']) await writeFile(`data/${name}`, files[`data/${name}`]);
  for (const name of ['styles.css', 'dataflex-theme.css']) await writeFile(name, files[name]);
  const app = files['app.js'];
  function fn(name) {
    const start = app.indexOf(`function ${name}(`);
    if (start < 0) throw new Error(`Missing function ${name}`);
    const end = app.indexOf('\n}', start);
    return app.slice(start, end + 2);
  }
  const helpers = ['escapeHtml', 'formatNumber', 'formatDate', 'isoDate', 'showToast', 'setDataStatus', 'buildSnapshotTrend', 'getTrendWindow', 'renderTrendChart'].map(fn).join('\n');
  const render = fn('renderBase').split('  renderCalendar();')[0] + '}';
  // Marker dates are public; the underlying promotion reports stay encrypted.
  const actionsBlock = app.slice(app.indexOf('const promotionActions = ') + 'const promotionActions = '.length, app.indexOf('\nconst trafficSnapshots'));
  const dates = [...new Set([...actionsBlock.matchAll(/(?:"date"|date):\s*"(\d{4}-\d{2}-\d{2})"/g)].map(match => match[1]))];
  const marks = `function getActionsForChart(data, baseline=189) { const dates=${JSON.stringify(dates)}; return data.map((point,index)=>{if(!dates.includes(point.date))return '';const x=46+(1160-46-22)/Math.max(1,data.length)*(index+.5);return '<g><line x1="'+x+'" x2="'+x+'" y1="43" y2="'+baseline+'" stroke="#df6a5b" stroke-dasharray="3 4" opacity="0.3"></line><circle class="action-marker" cx="'+x+'" cy="35" r="5"><title>运营 action</title></circle></g>';}).join('');}`;
  await writeFile('public.js', `(() => { let toastTimer; const state={ repo:null,starSnapshot:window.DATAMIND_STAR_SNAPSHOT,trend:[],activeRange:'all',starHistory:[] };\n${helpers}\n${render}\n${marks}\nstate.trend=buildSnapshotTrend(state.starSnapshot); renderBase(); setDataStatus('最后更新：'+formatDate(state.starSnapshot.fetched_at,true)); document.querySelector('#refreshButton').addEventListener('click',()=>location.reload()); })();\n`);
  console.log('Encrypted source and verified exact round-trip.');
} else throw new Error('Usage: node scripts/secure-build.mjs decrypt|encrypt');
