(async () => {
  const vault = window.DASHBOARD_VAULT;
  const storageKey = 'datamind-derived-key-v1';
  const form = document.querySelector('#accessForm');
  const input = document.querySelector('#accessPassword');
  const error = document.querySelector('#accessError');
  const remember = document.querySelector('#rememberUnlock');
  const decode = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));
  const encode = value => btoa(String.fromCharCode(...new Uint8Array(value)));
  const metadata = JSON.stringify({ version: vault.version, compression: vault.compression, kdf: vault.kdf, iterations: vault.iterations, salt: vault.salt });
  const forget = () => {
    try { localStorage.removeItem(storageKey); localStorage.removeItem('datamind-dashboard-unlocked-v1'); } catch {}
    try { sessionStorage.removeItem(storageKey); } catch {}
  };
  function restoredHTML(files) {
    let html = files['index.html'];
    html = html.replace(/<link\b[^>]*rel="stylesheet"[^>]*href="\.\/([^"?]+)[^"]*"[^>]*>/g, (tag, name) => files[name] ? `<style>${files[name]}</style>` : tag);
    html = html.replace(/<script src="\.\/([^"?]+)[^"]*"><\/script>/g, (tag, name) => {
      if (!(name in files)) throw new Error('Missing encrypted asset');
      return `<script>${files[name].replace(/<\/script/gi, '<\\/script')}</script>`;
    });
    const lockCode = `(() => { const b=document.createElement('button'); b.id='relockDashboard'; b.className='quiet-button'; b.textContent='重新锁定'; b.type='button'; b.style.cssText='position:fixed;right:20px;bottom:20px;z-index:10000;background:white'; b.onclick=()=>{try{localStorage.removeItem('${storageKey}');}catch{}try{sessionStorage.removeItem('${storageKey}');sessionStorage.setItem('datamind-relock','1');}catch{} location.reload();}; document.body.append(b); })();`;
    return html.replace('</body>', `<script>${lockCode}</script></body>`);
  }
  async function unlock(key, save) {
    const compressed = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(vault.iv), additionalData: new TextEncoder().encode(metadata) }, key, decode(vault.ciphertext));
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
    const files = JSON.parse(await new Response(stream).text());
    const html = restoredHTML(files);
    const raw = encode(await crypto.subtle.exportKey('raw', key));
    forget();
    const saved = JSON.stringify({ salt: vault.salt, iterations: vault.iterations, key: raw });
    try { (save ? localStorage : sessionStorage).setItem(storageKey, saved); } catch {}
    input.value = '';
    document.open(); document.write(html); document.close();
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true; error.textContent = '正在解密…';
    try {
      const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(input.value), 'PBKDF2', false, ['deriveKey']);
      input.value = '';
      const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: decode(vault.salt), iterations: vault.iterations }, material, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
      await unlock(key, remember.checked);
    } catch { error.textContent = '口令错误或密文无法验证，请重试。'; input.focus(); }
    finally { button.disabled = false; }
  });
  try {
    localStorage.removeItem('datamind-dashboard-unlocked-v1');
    if (sessionStorage.getItem('datamind-relock')) { sessionStorage.removeItem('datamind-relock'); return; }
    const persistent = localStorage.getItem(storageKey);
    const saved = JSON.parse(persistent || sessionStorage.getItem(storageKey) || 'null');
    if (saved?.salt === vault.salt && saved.iterations === vault.iterations) {
      const key = await crypto.subtle.importKey('raw', decode(saved.key), { name: 'AES-GCM' }, true, ['decrypt']);
      await unlock(key, Boolean(persistent));
    } else if (saved) forget();
  } catch { forget(); error.textContent = '已保存的密钥不可用，请重新输入口令。'; }
})();
