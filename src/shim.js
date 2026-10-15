// Mini-runtime que substitui o ambiente do dashboard publicado:
// lê os CSVs embutidos, executa os cálculos e controla filtros/redesenho.
(() => {
  const parseCSV = (txt) => {
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < txt.length; i++) {
      const ch = txt[i];
      if (q) { if (ch === '"') { if (txt[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && txt[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    const head = rows.shift();
    return { columns: head, data: rows.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]]))) };
  };
  const DS = {};
  document.querySelectorAll('script[type="text/csv"][data-dataset]').forEach((s) => { DS[s.dataset.dataset] = parseCSV(s.textContent.trim()); });
  const DEFAULTS = { area: null, curso: null, turma: null, minN: 5, metrica: 'media', ordem: 'form' };
  let params = { ...DEFAULTS };
  try { const h = new URLSearchParams(location.hash.slice(1)); for (const [k, v] of h) if (k in DEFAULTS) params[k] = v === '' ? null : (k === 'minN' || k === 'turma') ? Number(v) : v; } catch (e) { /* ignore */ }
  const subs = [];
  let pending = false;
  const run = () => { pending = false; subs.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); };
  const schedule = () => { if (!pending) { pending = true; requestAnimationFrame(run); } };
  const syncHash = () => { const h = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => { if (v != null && v !== DEFAULTS[k]) h.set(k, v); }); history.replaceState(null, '', h.toString() ? '#' + h.toString() : location.pathname + location.search); };
  const css = getComputedStyle(document.documentElement);
  window.dash = {
    colors: ['var(--color-ok)', 'var(--sv-c2)', 'var(--sv-c3)', 'var(--sv-c4)', 'var(--sv-c5)', 'var(--sv-c6)', 'var(--sv-c7)', 'var(--sv-c8)'],
    data: (id) => (DS[id] ? { status: 'ok', data: DS[id].data, columns: DS[id].columns, refreshing: false, meta: [] } : { status: 'missing', data: [], columns: [], meta: [] }),
    calc: (id, { inputs, fn }) => { const out = fn(...inputs.map((i) => DS[i].data)); DS[id] = { data: out, columns: out.length ? Object.keys(out[0]) : [] }; },
    loader: () => {},
    onData: (fn) => { subs.push(fn); try { fn(); } catch (e) { console.error(e); } },
    params: () => ({ ...params }),
    setParams: (p) => { params = { ...params, ...p }; syncHash(); schedule(); },
    resetParams: () => { params = { ...DEFAULTS }; syncHash(); schedule(); },
    setLink: () => {},
    refresh: () => {},
  };
  void css;
  let w = window.innerWidth;
  window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - w) > 4) { w = window.innerWidth; schedule(); } });
  window.addEventListener('hashchange', () => {});
})();
