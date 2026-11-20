(() => {
  const key = 'datamind-dashboard-unlocked-v1';
  const gate = document.querySelector('#accessGate');
  const content = document.querySelector('#lockedContent');
  const form = document.querySelector('#accessForm');
  const input = document.querySelector('#accessPassword');
  const error = document.querySelector('#accessError');
  const unlock = () => {
    content.hidden = false;
    gate.hidden = true;
  };
  try {
    if (localStorage.getItem(key) === 'unlocked') unlock();
  } catch { /* Unlock still works when browser storage is unavailable. */ }
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (input.value !== 'adastra') {
      error.textContent = '口令不正确，请重试。';
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    try { localStorage.setItem(key, 'unlocked'); } catch { /* Current page remains unlocked. */ }
    input.value = '';
    error.textContent = '';
    input.removeAttribute('aria-invalid');
    unlock();
    const heading = content.querySelector('h2');
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  });
})();
