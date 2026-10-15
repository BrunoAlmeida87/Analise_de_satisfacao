// Mini-runtime da versão independente (GitHub Pages): substitui o ambiente do dashboard publicado.
// Lê os CSVs embutidos (ou a base carregada pelo usuário), executa os cálculos e controla filtros e redesenho.
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
  const ORIG = {};
  document.querySelectorAll('script[type="text/csv"][data-dataset]').forEach((s) => { ORIG[s.dataset.dataset] = parseCSV(s.textContent.trim()); });
  const DS = { ...ORIG };
  const CALCS = [];
  let info = { kind: 'orig' };
  try {
    const saved = JSON.parse(localStorage.getItem('sv-base') || 'null');
    if (saved && saved.rel && saved.cur) {
      const toDS = (a) => ({ columns: a[0], data: a.slice(1).map((r) => Object.fromEntries(a[0].map((h, i) => [h, r[i] ?? '']))) });
      DS.relatorios = toDS(saved.rel); DS.cursos = toDS(saved.cur);
      info = { kind: 'user', file: saved.file, at: saved.at };
    }
  } catch (e) { /* ignore */ }

  const DEFAULTS = { areas: [], cursos: [], turmas: [], onlyFilled: false, grp: 'auto', minN: 5, metrica: 'media', ordem: 'form', rmetric: 'media' };
  const LISTS = ['areas', 'cursos', 'turmas'];
  let params = { ...DEFAULTS };
  try { const h = new URLSearchParams(location.hash.slice(1)); for (const [k, v] of h) if (k in DEFAULTS) params[k] = LISTS.includes(k) ? v.split(',').filter(Boolean) : k === 'minN' ? Number(v) : k === 'onlyFilled' ? v === 'true' : v; } catch (e) { /* ignore */ }
  const subs = [];
  let pending = false;
  const run = () => { pending = false; subs.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); };
  const schedule = () => { if (!pending) { pending = true; requestAnimationFrame(run); } };
  const syncHash = () => { const h = new URLSearchParams(); Object.keys(DEFAULTS).forEach((k) => { const v = params[k]; if (LISTS.includes(k)) { if (Array.isArray(v) && v.length) h.set(k, v.join(',')); } else if (v != null && v !== DEFAULTS[k]) h.set(k, v); }); try { history.replaceState(null, '', h.toString() ? '#' + h.toString() : location.pathname + location.search); } catch (e) { /* file:// may block */ } };
  const runCalc = ({ id, inputs, fn }) => { const out = fn(...inputs.map((i) => DS[i].data)); DS[id] = { data: out, columns: out.length ? Object.keys(out[0]) : [] }; };
  window.dash = {
    colors: ['var(--color-ok)'],
    data: (id) => (DS[id] ? { status: 'ok', data: DS[id].data, columns: DS[id].columns, refreshing: false, meta: [] } : { status: 'missing', data: [], columns: [], meta: [] }),
    calc: (id, { inputs, fn }) => { const c = { id, inputs, fn }; CALCS.push(c); runCalc(c); },
    loader: () => {},
    onData: (fn) => { subs.push(fn); try { fn(); } catch (e) { console.error(e); } },
    params: () => ({ ...params }),
    setParams: (p) => { params = { ...params, ...p }; syncHash(); schedule(); },
    resetParams: () => { params = { ...DEFAULTS }; syncHash(); schedule(); },
    setLink: () => {},
    refresh: () => {},
  };
  const recompute = () => { CALCS.forEach(runCalc); params = { ...params, areas: [], cursos: [], turmas: [] }; syncHash(); schedule(); };
  window.SV_BASE_INFO = () => info;
  window.SV_ORIG_CURSOS = () => ORIG.cursos.data;
  window.SV_SET_BASE = ({ relatorios, cursos }, file) => {
    DS.relatorios = { data: relatorios, columns: Object.keys(relatorios[0] || {}) };
    DS.cursos = { data: cursos, columns: Object.keys(cursos[0] || {}) };
    info = { kind: 'user', file, at: new Date().toISOString() };
    try {
      const arr = (ds) => [ds.columns, ...ds.data.map((r) => ds.columns.map((c) => r[c]))];
      localStorage.setItem('sv-base', JSON.stringify({ file, at: info.at, rel: arr(DS.relatorios), cur: arr(DS.cursos) }));
    } catch (e) { /* too large or blocked: stays for this session only */ }
    recompute();
  };
  window.SV_RESET_BASE = () => {
    DS.relatorios = ORIG.relatorios; DS.cursos = ORIG.cursos; info = { kind: 'orig' };
    try { localStorage.removeItem('sv-base'); } catch (e) { /* ignore */ }
    recompute();
  };
  let w = window.innerWidth;
  window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - w) > 4) { w = window.innerWidth; schedule(); } });
})();
