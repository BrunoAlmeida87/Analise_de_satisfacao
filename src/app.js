(() => {
  const root = document.querySelector('.sv');
  const I = window.SV_I18N;
  const $ = (id) => document.getElementById(id);
  const P = () => dash.params();
  const STANDALONE = !!window.SV_STANDALONE;

  // ---------- persistent viewer preferences ----------
  const store = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };
  const DEF_CFG = { notes: [null, null, null, null, null], accent: null, bands: [null, null, null, null], mode: 'abs', thrMean: [3.5, 4.0, 4.5], thrOt: [50, 65, 80], spanMean: 0.3, spanOt: 15 };
  const UI = {
    lang: store.get('sv-lang', 'pt'),
    clang: store.get('sv-clang', 'pt'),
    cfg: Object.assign(JSON.parse(JSON.stringify(DEF_CFG)), store.get('sv-cfg', {})),
  };
  let uiTick = 0;
  const redraw = () => dash.setParams({ ui: ++uiTick });

  // ---------- i18n ----------
  const Li = () => (UI.lang === 'en' ? 1 : 0);
  const LOC = () => (UI.lang === 'en' ? 'en-US' : 'pt-BR');
  const t = (k, v) => { const e = I.T[k]; let s = e ? e[Li()] : k; if (v) Object.keys(v).forEach((x) => { s = s.split('{' + x + '}').join(v[x]); }); return s; };
  const noteName = (i) => I.NOTAS[i][Li()];
  const qLabel = (k) => I.Q[k].l[Li()];
  const qShort = (k) => I.Q[k].s[Li()];
  const dimName = (k) => I.DIMS[k][Li()];
  const loc = (v, d) => (v == null || !isFinite(v) ? '—' : Number(v).toLocaleString(LOC(), { minimumFractionDigits: d, maximumFractionDigits: d }));
  const f1 = (v) => loc(v, 1), f2 = (v) => loc(v, 2), fi = (v) => (v == null ? '—' : Number(v).toLocaleString(LOC()));
  const pct = (v) => (v == null ? '—' : f1(v) + '%');
  const sgn = (v, d = 2, suf = '') => (v == null || !isFinite(v) ? '' : (v > 0 ? '+' : v < 0 ? '−' : '±') + loc(Math.abs(v), d) + suf);
  const enc = (s) => encodeURIComponent(s);
  let firstDraw = true;

  // ---------- DOM helpers ----------
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const mk = (text, field, esc, cls, src = 'escopos', key = 'escopo') => { const b = el('b', cls, text); b.dataset.source = src; b.dataset.field = field; b.dataset.where = key + '=' + enc(esc); return b; };
  const para = (node, parts) => node.replaceChildren(...parts.flat(3).filter((p) => p != null && p !== '').map((p) => (typeof p === 'string' ? document.createTextNode(p) : p)));
  const fail = (node) => { node.classList.remove('dash-skeleton'); node.replaceChildren(el('div', 'sv-fail', 'Failed to load')); };
  const empty = (node, msg) => { node.querySelectorAll(':scope > svg').forEach((s) => s.remove()); let e = node.querySelector(':scope > .sv-empty'); if (!e) { e = el('div', 'sv-empty'); node.prepend(e); } e.textContent = msg; };
  const clearChart = (node) => { node.querySelectorAll(':scope > svg, :scope > .sv-empty').forEach((s) => s.remove()); };
  const tipFor = (box) => { let tp = box.querySelector(':scope > .sv-tip'); if (!tp) { tp = el('div', 'sv-tip'); box.appendChild(tp); } return tp; };
  const showTip = (box, tip, ev, head, lines) => {
    tip.replaceChildren(el('div', 'sv-tip-h', head));
    lines.forEach((l) => { const d = el('div'); if (Array.isArray(l)) { const sw = el('i'); sw.style.background = l[0]; d.append(sw, l[1]); } else d.textContent = l; tip.appendChild(d); });
    const r = box.getBoundingClientRect();
    tip.style.opacity = 1;
    let x = ev.clientX - r.left + 14, y = ev.clientY - r.top + 14;
    if (x + tip.offsetWidth > r.width) x = Math.max(0, ev.clientX - r.left - tip.offsetWidth - 14);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  };
  const hideTip = (tip) => { tip.style.opacity = 0; };
  const styleAxis = (a) => { a.attr('font-size', null).attr('font-family', null); a.selectAll('text').style('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)'); a.selectAll('line,path').style('stroke', 'var(--cds-chart-axis)'); };
  const textW = (svg, txt, size) => { const tt = svg.append('text').style('font-size', size).text(txt); const w = tt.node().getComputedTextLength(); tt.remove(); return w; };
  const infoBtn = (key) => { const b = el('button', 'sv-i', 'i'); b.type = 'button'; b.dataset.tip = key; return b; };
  const toast = (msg) => { const tt = $('sv-toast'); tt.textContent = msg; tt.style.opacity = 1; clearTimeout(toast.h); toast.h = setTimeout(() => { tt.style.opacity = 0; }, 2200); };

  // ---------- colors ----------
  const NV = ['var(--sv-n1)', 'var(--sv-n2)', 'var(--sv-n3)', 'var(--sv-n4)', 'var(--sv-n5)'];
  const HB = ['var(--sv-h1)', 'var(--sv-h2)', 'var(--sv-h3)', 'var(--sv-h4)'];
  function applyColors() {
    const c = UI.cfg;
    const setv = (name, v) => { if (v) root.style.setProperty(name, v); else root.style.removeProperty(name); };
    setv('--sv-accent', c.accent || dash.colors[0]);
    c.notes.forEach((v, i) => setv('--sv-n' + (i + 1), v));
    c.bands.forEach((v, i) => setv('--sv-h' + (i + 1), v));
  }
  const band = (v, metric) => { if (v == null) return -1; const th = metric === 'otimo' ? UI.cfg.thrOt : UI.cfg.thrMean; return v >= th[2] ? 3 : v >= th[1] ? 2 : v >= th[0] ? 1 : 0; };
  const cellFill = (v, refv, metric) => {
    if (v == null) return 'transparent';
    if (UI.cfg.mode === 'abs') { const b = band(v, metric); return `color-mix(in srgb, ${HB[b]} 52%, transparent)`; }
    if (refv == null) return 'transparent';
    const span = metric === 'otimo' ? UI.cfg.spanOt : UI.cfg.spanMean;
    const d = v - refv, a = Math.min(1, Math.abs(d) / span) * 64;
    return `color-mix(in srgb, ${d >= 0 ? HB[3] : HB[0]} ${a.toFixed(0)}%, transparent)`;
  };
  const toHex = (css) => {
    const p = el('i'); p.style.color = css; root.appendChild(p); const c = getComputedStyle(p).color; p.remove();
    let m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
    let rgb = m ? [m[1], m[2], m[3]].map(Number) : null;
    if (!rgb) { m = c.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/); if (m) rgb = [m[1], m[2], m[3]].map((x) => Number(x) * 255); }
    if (!rgb) return '#888888';
    return '#' + rgb.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
  };

  // ---------- data indexes ----------
  let IDX = null;
  function indexes(E, Iq, K, C) {
    if (IDX && IDX.src[0] === E && IDX.src[1] === Iq && IDX.src[2] === K && IDX.src[3] === C) return IDX;
    const e = new Map(E.map((r) => [r.escopo, r]));
    const kids = new Map();
    E.forEach((r) => { if (!r.pai) return; if (!kids.has(r.pai)) kids.set(r.pai, []); kids.get(r.pai).push(r); });
    const i = new Map(); Iq.forEach((r) => { if (!i.has(r.escopo)) i.set(r.escopo, []); i.get(r.escopo).push(r); });
    i.forEach((a) => a.sort((x, y) => x.ordem - y.ordem));
    const k = new Map(); K.forEach((r) => { if (!k.has(r.escopo)) k.set(r.escopo, []); k.get(r.escopo).push(r); });
    const cursosMap = new Map(C.map((c) => [c.sigla, c]));
    IDX = { src: [E, Iq, K, C], e, kids, i, k, cursos: C, cursosMap };
    return IDX;
  }
  const cname = (X, sigla) => { const c = X.cursosMap.get(sigla); if (!c) return sigla; return UI.clang === 'en' ? (c.curso_en || c.curso) : c.curso; };
  const rowName = (X, r) => (r.nivel === 'geral' ? t('all_courses') : r.nivel === 'area' ? t('area_x', { a: r.area }) : r.nivel === 'curso' ? cname(X, r.sigla) : t('turma_x', { t: r.turma }));
  const rowFull = (X, r) => (r.nivel === 'curso' ? r.sigla + ' · ' + cname(X, r.sigla) : r.nivel === 'turma' ? r.sigla + ' · ' + t('turma_x', { t: r.turma }) : rowName(X, r));

  // ---------- scope ----------
  function escopoAtual(X) {
    const p = P();
    if (p.curso && p.turma != null && p.turma !== '' && X.e.has('T:' + p.curso + ':' + p.turma)) return 'T:' + p.curso + ':' + p.turma;
    if (p.curso && X.e.has('C:' + p.curso)) return 'C:' + p.curso;
    if (p.area && X.e.has('A:' + p.area)) return 'A:' + p.area;
    return 'geral';
  }
  function compRows(X, esc) {
    const r = X.e.get(esc);
    if (r.nivel === 'geral') return [...X.e.values()].filter((x) => x.nivel === 'curso');
    if (r.nivel === 'area' || r.nivel === 'curso') return X.kids.get(esc) || [];
    return X.kids.get(r.pai) || [];
  }
  function partRows(X, esc) {
    const r = X.e.get(esc);
    if (r.nivel === 'geral') return X.kids.get('geral') || [];
    if (r.nivel === 'turma') return X.kids.get(r.pai) || [];
    return X.kids.get(esc) || [];
  }
  const drill = (r) => {
    if (r.nivel === 'area') dash.setParams({ area: r.area, curso: null, turma: null });
    else if (r.nivel === 'curso') dash.setParams({ area: r.area, curso: r.sigla, turma: null });
    else if (r.nivel === 'turma') dash.setParams({ area: r.area, curso: r.sigla, turma: r.turma });
  };
  const minN = () => Number(P().minN ?? 5);

  // ---------- static text ----------
  function applyI18n() {
    document.querySelectorAll('.sv [data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
    $('rank-search').placeholder = t('search');
    document.querySelectorAll('.sv-png').forEach((b) => { b.title = t('png_title'); });
    document.querySelectorAll('.sv-csv').forEach((b) => { b.title = t('csv_title'); });
    document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(UI.lang === b.dataset.lang)));
    const fc = $('f-clang'); fc.options[0].textContent = t('clang_pt'); fc.options[1].textContent = t('clang_en'); fc.value = UI.clang;
    const fm = $('f-min'); const cur = String(P().minN ?? 5);
    fm.replaceChildren(...[1, 5, 10, 30].map((n) => new Option(n === 1 ? t('min_all') : t('min_n', { n }), String(n))));
    fm.value = cur;
    // glossary
    const dl = $('dl-metricas');
    dl.replaceChildren(...Object.keys(I.M).flatMap((k) => { const [tt, d] = I.M[k][Li()]; return [el('dt', '', tt), el('dd', '', d)]; }));
    const dq = $('dl-perguntas');
    const groups = [['programa', ['objetivos', 'teoria_pratica', 'material']], ['organizacao', ['pontualidade', 'instalacoes', 'apoio_adm', 'audiovisuais']], ['instrutor', ['dominio', 'clareza', 'duvidas']], [null, ['conhec_antes', 'conhec_apos']]];
    dq.replaceChildren(...groups.flatMap(([g, ks]) => ks.flatMap((k) => { const dt = el('dt', '', qLabel(k)); dt.append(el('small', '', g ? dimName(g) : (Li() ? 'Learning' : 'Aprendizagem'))); return [dt, el('dd', '', I.Q[k].d[Li()])]; })));
    $('lim-list').replaceChildren(...I.LIM.map((l) => el('li', '', l[Li()])));
    updateBaseLabel();
  }
  function updateBaseLabel() {
    const b = window.SV_BASE_INFO ? window.SV_BASE_INFO() : null;
    $('sv-base-label').textContent = STANDALONE ? '· ' + (b && b.kind === 'user' ? t('base_user', { f: b.file, d: new Date(b.at).toLocaleDateString(LOC()) }) : t('base_orig')) : '';
  }

  // ---------- popover for ⓘ ----------
  const pop = $('sv-pop');
  const tipText = (key) => {
    if (key.startsWith('q:')) { const q = I.Q[key.slice(2)]; return [q.l[Li()], q.d[Li()]]; }
    const m = I.M[key]; return m ? m[Li()] : [key, ''];
  };
  const showPop = (btn) => {
    const [h, d] = tipText(btn.dataset.tip);
    pop.replaceChildren(el('b', '', h), document.createTextNode(d));
    const rr = root.getBoundingClientRect(), br = btn.getBoundingClientRect();
    pop.style.opacity = 1;
    let x = br.left - rr.left - 10, y = br.bottom - rr.top + 8;
    if (x + pop.offsetWidth > rr.width) x = Math.max(0, rr.width - pop.offsetWidth);
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
  };
  const hidePop = () => { pop.style.opacity = 0; };
  root.addEventListener('mouseover', (e) => { const b = e.target.closest('.sv-i'); if (b) showPop(b); });
  root.addEventListener('mouseout', (e) => { if (e.target.closest('.sv-i')) hidePop(); });
  root.addEventListener('focusin', (e) => { const b = e.target.closest('.sv-i'); if (b) showPop(b); });
  root.addEventListener('focusout', (e) => { if (e.target.closest('.sv-i')) hidePop(); });
  root.addEventListener('click', (e) => { const b = e.target.closest('.sv-i'); if (b) { e.stopPropagation(); showPop(b); } }, true);

  // ---------- filters & controls ----------
  const fArea = $('f-area'), fCurso = $('f-curso'), fTurma = $('f-turma'), fMin = $('f-min');
  fArea.addEventListener('change', () => dash.setParams({ area: fArea.value || null, curso: null, turma: null }));
  fCurso.addEventListener('change', () => {
    const v = fCurso.value || null;
    const c = v && IDX ? IDX.cursosMap.get(v) : null;
    dash.setParams({ curso: v, turma: null, area: c ? c.area : P().area ?? null });
  });
  fTurma.addEventListener('change', () => dash.setParams({ turma: fTurma.value === '' ? null : Number(fTurma.value) }));
  fMin.addEventListener('change', () => dash.setParams({ minN: Number(fMin.value) }));
  $('f-clang').addEventListener('change', (e) => { UI.clang = e.target.value; store.set('sv-clang', UI.clang); redraw(); });
  $('f-reset').addEventListener('click', () => dash.resetParams());
  document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => { UI.lang = b.dataset.lang; store.set('sv-lang', UI.lang); applyI18n(); buildCfgPanel(); redraw(); }));
  document.querySelectorAll('[data-ordem]').forEach((b) => b.addEventListener('click', () => dash.setParams({ ordem: b.dataset.ordem })));
  document.querySelectorAll('[data-metrica]').forEach((b) => b.addEventListener('click', () => dash.setParams({ metrica: b.dataset.metrica })));
  const togglePanel = (btn, panel) => { const open = panel.hidden; panel.hidden = !open; btn.setAttribute('aria-expanded', String(open)); };
  $('btn-colors').addEventListener('click', () => togglePanel($('btn-colors'), $('colors-panel')));
  $('cfg-close').addEventListener('click', () => togglePanel($('btn-colors'), $('colors-panel')));
  $('btn-print').addEventListener('click', () => { try { window.print(); } catch (e) { /* not available */ } });
  if (STANDALONE) {
    const bt = $('btn-theme'); bt.hidden = false;
    bt.addEventListener('click', () => { const r = document.documentElement; const dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; r.dataset.theme = dark ? 'light' : 'dark'; buildCfgPanel(); redraw(); });
  }
  if (STANDALONE && window.SV_UPLOAD) {
    const bu = $('btn-upload'); bu.hidden = false;
    bu.addEventListener('click', () => togglePanel(bu, $('upload-panel')));
    $('up-choose').addEventListener('click', () => $('up-file').click());
    $('up-file').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const msg = $('up-msg'); msg.className = 'sv-upmsg'; msg.textContent = t('up_loading');
      try { const r = await window.SV_UPLOAD.load(f); msg.textContent = t('up_ok', { f: f.name, n: fi(r.n) }); msg.classList.add('sv-good'); IDX = null; updateBaseLabel(); }
      catch (err) { msg.textContent = t('up_err', { e: err.message || String(err) }); msg.classList.add('sv-bad'); }
      e.target.value = '';
    });
    $('up-restore').addEventListener('click', () => { window.SV_UPLOAD.restore(); IDX = null; $('up-msg').textContent = ''; updateBaseLabel(); });
  }

  // section nav
  const navLinks = [...document.querySelectorAll('#sv-nav a')];
  navLinks.forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); const id = a.getAttribute('href').slice(1); const s = $(id); if (s) { s.scrollIntoView({ behavior: 'smooth', block: 'start' }); try { dash.setLink(id); } catch (err) { /* ignore */ } } }));
  try {
    const io = new IntersectionObserver((ents) => { ents.forEach((en) => { if (en.isIntersecting) navLinks.forEach((a) => a.classList.toggle('sv-on', a.getAttribute('href') === '#' + en.target.id)); }); }, { root: document, rootMargin: '-35% 0px -60% 0px' });
    navLinks.forEach((a) => { const s = $(a.getAttribute('href').slice(1)); if (s) io.observe(s); });
  } catch (e) { /* no observer */ }

  function drawFilters(X, esc) {
    const p = P();
    const areas = d3.rollups(X.cursos, (v) => v.length, (c) => c.area).sort((a, b) => d3.ascending(a[0], b[0]));
    fArea.replaceChildren(new Option(t('all_areas'), ''), ...areas.map(([a, n]) => new Option(`${a} · ${t(n > 1 ? 'n_courses_pl' : 'n_courses', { n })}`, a)));
    fArea.value = p.area ?? '';
    const cs = X.cursos.filter((c) => !p.area || c.area === p.area).slice().sort((a, b) => d3.ascending(a.sigla, b.sigla));
    fCurso.replaceChildren(new Option(p.area ? t('all_courses_area') : t('all_courses'), ''), ...cs.map((c) => new Option(`${c.sigla} · ${cname(X, c.sigla)}`, c.sigla)));
    fCurso.value = p.curso ?? '';
    const ts = p.curso ? (X.kids.get('C:' + p.curso) || []).slice().sort((a, b) => a.turma - b.turma) : [];
    fTurma.replaceChildren(new Option(p.curso ? t('all_classes') : '—', ''), ...ts.map((tt) => new Option(`${t('turma_x', { t: tt.turma })} · ${t(tt.preenchidas === 1 ? 'n_forms_one' : 'n_forms', { n: tt.preenchidas })}`, String(tt.turma))));
    fTurma.disabled = !p.curso;
    fTurma.value = p.turma != null && p.curso ? String(p.turma) : '';
    fMin.value = String(p.minN ?? 5);
    document.querySelectorAll('[data-ordem]').forEach((b) => b.setAttribute('aria-pressed', String((p.ordem || 'form') === b.dataset.ordem)));
    document.querySelectorAll('[data-metrica]').forEach((b) => b.setAttribute('aria-pressed', String((p.metrica || 'media') === b.dataset.metrica)));
    const r = X.e.get(esc);
    $('sv-scope').replaceChildren(el('b', '', rowFull(X, r)), document.createTextNode(t('filled_forms', { n: fi(r.preenchidas) })));
  }

  // ---------- colors panel ----------
  function buildCfgPanel() {
    const c = UI.cfg;
    const save = () => { store.set('sv-cfg', UI.cfg); applyColors(); paintPreview(); redraw(); };
    const swatch = (label, css, onChange) => { const w = el('label', 'sv-sw'); const inp = el('input'); inp.type = 'color'; inp.value = toHex(css); inp.addEventListener('input', () => onChange(inp.value)); w.append(inp, label); return w; };
    $('cfg-notes').replaceChildren(...[0, 1, 2, 3, 4].map((i) => swatch(`${i + 1} · ${noteName(i)}`, c.notes[i] || NV[i], (v) => { c.notes[i] = v; save(); })));
    $('cfg-accent').replaceChildren(swatch(t('cfg_accent'), c.accent || 'var(--sv-accent)', (v) => { c.accent = v; save(); }));
    document.querySelectorAll('#cfg-mode [data-mode]').forEach((b) => { b.setAttribute('aria-pressed', String(c.mode === b.dataset.mode)); b.onclick = () => { c.mode = b.dataset.mode; buildCfgPanel(); save(); }; });
    const abs = $('cfg-abs'), rel = $('cfg-rel');
    abs.hidden = c.mode !== 'abs'; rel.hidden = c.mode !== 'rel';
    // bands: colors + thresholds
    const bandsRow = el('div', 'sv-swatches'); bandsRow.style.marginTop = '12px';
    [0, 1, 2, 3].forEach((i) => bandsRow.append(swatch(t('band_' + (i + 1)), c.bands[i] || HB[i], (v) => { c.bands[i] = v; save(); })));
    const thr = el('div', 'sv-thr');
    thr.append(el('span'), ...[1, 2, 3].map((i) => { const h = el('span', 'sv-thr-h'); const sw = el('i'); sw.style.background = HB[i]; h.append(sw, t('band_' + (i + 1))); return h; }));
    const thrRow = (lbl, arr, step) => { thr.append(el('span', '', lbl)); arr.forEach((v, j) => { const inp = el('input'); inp.type = 'number'; inp.step = step; inp.value = v; inp.title = t('cfg_from'); inp.addEventListener('change', () => { const n = Number(inp.value); if (isFinite(n)) { arr[j] = n; arr.sort((a, b) => a - b); save(); } }); thr.append(inp); }); };
    thrRow(t('cfg_thr_mean'), c.thrMean, '0.05'); thrRow(t('cfg_thr_ot'), c.thrOt, '1');
    const thrNote = el('div', 'sv-card-note'); thrNote.textContent = (Li() ? 'Each value is where the band starts ("from"). Below the first one: ' : 'Cada valor é onde a faixa começa ("a partir de"). Abaixo do primeiro: ') + t('band_1') + '.';
    abs.replaceChildren(bandsRow, thr, thrNote);
    const relRow = el('div', 'sv-thr'); relRow.style.gridTemplateColumns = 'auto minmax(0,5.2rem) minmax(0,5.2rem)';
    relRow.append(el('span'), el('span', '', t('m_media')), el('span', '', t('m_otimo')));
    relRow.append(el('span', '', t('cfg_span')));
    [['spanMean', '0.05'], ['spanOt', '1']].forEach(([k, st]) => { const inp = el('input'); inp.type = 'number'; inp.step = st; inp.value = c[k]; inp.addEventListener('change', () => { const n = Number(inp.value); if (n > 0) { c[k] = n; save(); } }); relRow.append(inp); });
    const relBands = el('div', 'sv-swatches'); relBands.style.marginTop = '12px';
    relBands.append(swatch(t('lg_below'), c.bands[0] || HB[0], (v) => { c.bands[0] = v; save(); }), swatch(t('lg_above'), c.bands[3] || HB[3], (v) => { c.bands[3] = v; save(); }));
    rel.replaceChildren(relBands, relRow);
    paintPreview();
  }
  function paintPreview() {
    const vals = UI.cfg.mode === 'abs' ? [3.2, 3.7, 4.0, 4.3, 4.6, 4.9] : [4.40, 4.55, 4.70, 4.85, 4.95];
    $('cfg-preview').replaceChildren(...vals.map((v) => { const s = el('span', '', f2(v)); s.style.background = cellFill(v, 4.7, 'media'); return s; }));
  }
  $('cfg-reset').addEventListener('click', () => { UI.cfg = JSON.parse(JSON.stringify(DEF_CFG)); store.set('sv-cfg', UI.cfg); applyColors(); buildCfgPanel(); redraw(); });

  // ---------- KPIs ----------
  function deltaLine(node, v, ref, d, suf, unit = '') {
    if (ref == null || v == null) { node.textContent = ''; return; }
    const diff = v - ref;
    node.replaceChildren();
    const s = el('span', Math.abs(diff) < Math.pow(10, -d) ? '' : diff > 0 ? 'sv-good' : 'sv-bad', (diff > 0 ? '▲ ' : diff < 0 ? '▼ ' : '') + sgn(diff, d, unit));
    node.append(s, document.createTextNode(t('vs_all', { v: loc(ref, d) + suf })));
  }
  function drawKpis(X, esc) {
    const r = X.e.get(esc), g = X.e.get('geral'), isG = esc === 'geral';
    document.querySelectorAll('#kpis .sv-k, #know-side .sv-k').forEach((n) => { n.dataset.source = 'escopos'; n.dataset.where = 'escopo=' + enc(esc); });
    $('k-indice').textContent = f2(r.indice);
    $('k-pips').replaceChildren(...[0, 1, 2, 3, 4].map((i) => { const p = el('div', 'sv-pip'); const f = el('i'); f.style.width = Math.max(0, Math.min(1, (r.indice ?? 0) - i)) * 100 + '%'; p.appendChild(f); return p; }));
    deltaLine($('d-indice'), r.indice, isG ? null : g.indice, 2, '');
    $('k-otimo').textContent = f1(r.pct_otimo);
    const dist = [r.pct_fraco, r.pct_regular, r.pct_bom, r.pct_muito_bom, r.pct_otimo];
    $('k-dist').replaceChildren(...dist.map((v, i) => { const s = el('span'); s.style.width = (v ?? 0) + '%'; s.style.background = NV[i]; return s; }).filter((s, i) => dist[i] > 0));
    deltaLine($('d-otimo'), r.pct_otimo, isG ? null : g.pct_otimo, 1, '%', t('pp'));
    para($('k-atebom-line'), [t('k_atebom', { v: '§' }).split('§')[0], mk(f1(r.pct_ate_bom), 'pct_ate_bom', esc), t('k_atebom', { v: '§' }).split('§')[1]]);
    $('k-max').textContent = f1(r.pct_nota_maxima);
    const pp = el('div', 'sv-pip'); const fill = el('i'); fill.style.width = (r.pct_nota_maxima ?? 0) + '%'; pp.appendChild(fill); $('k-max-bar').replaceChildren(pp);
    deltaLine($('d-max'), r.pct_nota_maxima, isG ? null : g.pct_nota_maxima, 1, '%', t('pp'));
    $('k-taxa').textContent = f1(r.taxa_resposta);
    $('k-taxa').classList.toggle('sv-bad', r.taxa_resposta != null && r.taxa_resposta < 50);
    deltaLine($('d-taxa'), r.taxa_resposta, isG ? null : g.taxa_resposta, 1, '%', t('pp'));
    const tl = t('k_taxa_n', { p: '§1', e: '§2', f: '§3' }).split(/§[123]/);
    para($('k-taxa-line'), [tl[0], mk(fi(r.preenchidas), 'preenchidas', esc), tl[1], fi(r.preenchidas + r.nao_preenchidas), tl[2], mk(fi(r.faltosos), 'faltosos', esc), tl[3]]);
    const ring = d3.select('#k-ring'); ring.selectAll('*').remove();
    const arc = d3.arc().innerRadius(20).outerRadius(26).cornerRadius(3);
    const gg = ring.append('g').attr('transform', 'translate(27,27)');
    gg.append('path').attr('d', arc({ startAngle: 0, endAngle: 2 * Math.PI })).style('fill', 'var(--sv-n3)');
    gg.append('path').attr('d', arc({ startAngle: 0, endAngle: 2 * Math.PI * (r.taxa_resposta ?? 0) / 100 })).style('fill', r.taxa_resposta < 50 ? 'var(--color-bad)' : 'var(--sv-accent)');
    $('k-ganho').textContent = r.ganho == null ? '—' : sgn(r.ganho, 2);
    const gd = t('k_ganho_d', { a: '§', d: '§' }).split('§');
    para($('k-ganho-d'), [gd[0], mk(f2(r.conhec_antes), 'conhec_antes', esc), gd[1], mk(f2(r.conhec_apos), 'conhec_apos', esc), gd[2]]);
    const gn = t('k_ganho_n', { v: '§' }).split('§');
    para($('k-ganho-n'), [gn[0], mk(f1(r.pct_evoluiu), 'pct_evoluiu', esc), gn[1]]);
    $('kn-antes').textContent = f2(r.conhec_antes); $('kn-apos').textContent = f2(r.conhec_apos);
    $('kn-ev').textContent = pct(r.pct_evoluiu); $('kn-ig').textContent = pct(r.pct_igual); $('kn-rg').textContent = pct(r.pct_regrediu);
  }

  // ---------- Takeaway ----------
  function drawTake(X, esc) {
    const r = X.e.get(esc), its = (X.i.get(esc) || []).filter((x) => x.n > 0);
    const node = $('sv-take'); node.classList.remove('dash-skeleton');
    const en = Li() === 1;
    if (!r.preenchidas) {
      para(node, en ? [rowFull(X, r), ' has no completed forms: of ', mk(fi(r.fichas), 'fichas', esc), ' forms on record, ', mk(fi(r.nao_preenchidas), 'nao_preenchidas', esc), ' were not completed and ', mk(fi(r.faltosos), 'faltosos', esc), ' belong to absent students.']
        : [rowFull(X, r), ' não tem fichas preenchidas: das ', mk(fi(r.fichas), 'fichas', esc), ' fichas registradas, ', mk(fi(r.nao_preenchidas), 'nao_preenchidas', esc), ' não foram preenchidas e ', mk(fi(r.faltosos), 'faltosos', esc), ' são de alunos faltosos.']);
      return;
    }
    const best = [...its].sort((a, b) => b.pct5 - a.pct5)[0], worst = [...its].sort((a, b) => a.pct5 - b.pct5)[0];
    const mi = (text, field, it, cls) => { const b = el('b', cls, text); b.dataset.source = 'itens'; b.dataset.field = field; b.dataset.where = 'escopo=' + enc(esc) + '&chave=' + enc(it.chave); return b; };
    const parts = en
      ? [esc === 'geral' ? 'High, consistent satisfaction: ' : rowFull(X, r) + ': ', 'index of ', mk(f2(r.indice), 'indice', esc), ' out of 5, with ', mk(pct(r.pct_otimo), 'pct_otimo', esc, 'sv-good'), ' of answers rated "Excellent". ']
      : [esc === 'geral' ? 'Satisfação alta e consistente: ' : rowFull(X, r) + ': ', 'índice de ', mk(f2(r.indice), 'indice', esc), ' em 5, com ', mk(pct(r.pct_otimo), 'pct_otimo', esc, 'sv-good'), ' das respostas em "Ótimo". '];
    if (best && worst && best !== worst) parts.push(en
      ? ['The strongest point is ', el('b', '', qLabel(best.chave)), ' (', mi(pct(best.pct5), 'pct5', best), ' Excellent); the furthest from excellence is ', el('b', 'sv-bad', qLabel(worst.chave)), ' (', mi(pct(worst.pct5), 'pct5', worst), '). ']
      : ['O ponto mais forte é ', el('b', '', qLabel(best.chave)), ' (', mi(pct(best.pct5), 'pct5', best), ' Ótimo); o mais distante da excelência é ', el('b', 'sv-bad', qLabel(worst.chave)), ' (', mi(pct(worst.pct5), 'pct5', worst), '). ']);
    if (r.conhec_antes != null) parts.push(en ? ['Self-reported knowledge rises from ', mk(f2(r.conhec_antes), 'conhec_antes', esc), ' to ', mk(f2(r.conhec_apos), 'conhec_apos', esc), '. '] : ['O conhecimento declarado sobe de ', mk(f2(r.conhec_antes), 'conhec_antes', esc), ' para ', mk(f2(r.conhec_apos), 'conhec_apos', esc), '. ']);
    if (r.taxa_resposta != null && r.taxa_resposta < 70) parts.push(en ? ['The biggest risk is data collection: only ', mk(pct(r.taxa_resposta), 'taxa_resposta', esc, 'sv-bad'), ' of expected forms came back completed.'] : ['O maior risco está na coleta: só ', mk(pct(r.taxa_resposta), 'taxa_resposta', esc, 'sv-bad'), ' das fichas esperadas voltaram preenchidas.']);
    para(node, parts);
  }

  // ---------- Items ----------
  function drawItens(X, esc) {
    const box = $('chart-itens'); box.classList.remove('dash-skeleton'); clearChart(box);
    const tip = tipFor(box);
    const rows = (X.i.get(esc) || []).filter((r) => r.n > 0);
    const lg = $('lg-itens');
    const ref = esc !== 'geral' ? new Map((X.i.get('geral') || []).map((r) => [r.chave, r])) : null;
    lg.replaceChildren(...[4, 3, 2, 1, 0].map((i) => { const s = el('span'); const sw = el('i'); sw.style.background = NV[i]; s.append(sw, `${i + 1} · ${noteName(i)}`); return s; }));
    if (ref) { const s = el('span'); s.append(el('i', 'sv-lg-line'), t('ref_all')); lg.appendChild(s); }
    const r0 = X.e.get(esc);
    $('itens-note').textContent = t('c_itens_n', { n: fi(r0.preenchidas) });
    if (!rows.length) { empty(box, t('no_resp')); return; }
    const W = box.clientWidth; if (!W) return;
    const narrow = W < 620;
    const ordem = P().ordem || 'form';
    let list = [];
    if (ordem === 'rank') list = [...rows].sort((a, b) => b.pct5 - a.pct5 || b.media - a.media).map((r) => ({ t: 'row', r }));
    else if (ordem === 'pol') list = [...rows].sort((a, b) => (b.dp ?? 0) - (a.dp ?? 0)).map((r) => ({ t: 'row', r }));
    else { let dim = null; rows.forEach((r) => { if (r.dimensao !== dim) { dim = r.dimensao; list.push({ t: 'head', dim }); } list.push({ t: 'row', r }); }); }
    const svg = d3.select(box).insert('svg', '.sv-tip').attr('width', '100%');
    const labW = narrow ? 0 : d3.max(rows, (r) => textW(svg, qLabel(r.chave), 'var(--cds-font-size-body)')) + 22;
    const statW = narrow ? 50 : 84;
    const L = Math.max(12, d3.max(rows, (r) => 100 - r.pct5));
    const R = Math.max(d3.max(rows, (r) => r.pct5), ref ? d3.max(rows, (r) => ref.get(r.chave)?.pct5 ?? 0) : 0);
    const x = d3.scaleLinear([-L, R], [labW + 46, W - statW - 50]);
    const rowH = narrow ? 52 : 36, headH = 34, top = 26, barH = 20;
    let y = top; list.forEach((d) => { d.y = y; y += d.t === 'head' ? headH : rowH; });
    const H = y + 6;
    svg.attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const cap = (tx, xx, anchor) => svg.append('text').attr('x', xx).attr('y', 12).attr('text-anchor', anchor).style('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)').text(tx);
    cap(t('ax_other'), x(-L), 'start'); cap(t('ax_top'), x(R), 'end'); cap(ordem === 'pol' ? t('ax_sd') : t('ax_mean'), W, 'end');
    svg.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', top - 6).attr('y2', H - 4).style('stroke', 'var(--cds-chart-reference)').attr('stroke-dasharray', '3 3');
    list.forEach((d, idx) => {
      const g = svg.append('g').attr('transform', `translate(0,${d.y})`).attr('class', firstDraw ? 'sv-fade' : null).style('animation-delay', idx * 25 + 'ms');
      if (d.t === 'head') {
        g.append('text').attr('x', 0).attr('y', 22).style('font-size', '11px').style('letter-spacing', '.08em').style('text-transform', 'uppercase').style('fill', 'var(--color-fg-muted)').style('font-weight', 'var(--cds-font-weight-medium)').text(dimName(d.dim));
        g.append('text').attr('x', W).attr('y', 22).attr('text-anchor', 'end').style('font-size', 'var(--cds-font-size-caption)').style('fill', 'var(--color-fg-muted)').text(t('dim_head', { m: f2(r0['media_' + d.dim]), o: pct(r0['otimo_' + d.dim]) }));
        g.append('line').attr('x1', 0).attr('x2', W).attr('y1', 28).attr('y2', 28).style('stroke', 'var(--cds-chart-grid)');
        return;
      }
      const r = d.r, by = narrow ? 24 : (rowH - barH) / 2;
      const ly = narrow ? 14 : by + barH / 2 + 5;
      g.append('text').attr('x', 0).attr('y', ly).style('font-size', 'var(--cds-font-size-body)').style('fill', 'var(--color-fg)').text(qLabel(r.chave));
      let cum = 0; const segs = [];
      [4, 3, 2, 1].forEach((k) => { const v = r['pct' + k] || 0; segs.push({ k, x0: -(cum + v), x1: -cum, v }); cum += v; });
      segs.push({ k: 5, x0: 0, x1: r.pct5, v: r.pct5 });
      g.selectAll('rect').data(segs.filter((s) => s.v > 0)).join('rect')
        .attr('x', (s) => x(s.x0) + (s.k === 5 ? 1 : 0.5)).attr('width', (s) => Math.max(1, x(s.x1) - x(s.x0) - 1)).attr('y', by).attr('height', barH).attr('rx', 3)
        .style('fill', (s) => NV[s.k - 1])
        .on('mousemove', (ev) => showTip(box, tip, ev, `${qLabel(r.chave)} · ${fi(r.n)}`, [5, 4, 3, 2, 1].map((k) => [NV[k - 1], `${k} ${noteName(k - 1)}: ${pct(r['pct' + k])}`]).concat([`σ ${f2(r.dp)}`]).concat(ref ? [t('ref_all') + ': ' + pct(ref.get(r.chave)?.pct5)] : [])))
        .on('mouseleave', () => hideTip(tip));
      g.append('text').attr('x', x(-(100 - r.pct5)) - 6).attr('y', by + barH / 2 + 4).attr('text-anchor', 'end').style('font-size', 'var(--cds-font-size-caption)').style('fill', 'var(--color-fg-muted)').text(pct(100 - r.pct5));
      let endX = x(r.pct5);
      if (ref && ref.get(r.chave)) {
        const rx = x(ref.get(r.chave).pct5);
        g.append('line').attr('x1', rx).attr('x2', rx).attr('y1', by - 4).attr('y2', by + barH + 4).style('stroke', 'var(--color-fg)').style('stroke-width', 2);
        endX = Math.max(endX, rx);
      }
      g.append('text').attr('x', endX + 7).attr('y', by + barH / 2 + 4).style('font-size', 'var(--cds-font-size-caption)').style('fill', 'var(--color-fg)').style('font-weight', 'var(--cds-font-weight-medium)').text(pct(r.pct5));
      g.append('text').attr('x', W).attr('y', by + barH / 2 + 6).attr('text-anchor', 'end').style('font-family', 'var(--font-anthropic-serif)').style('font-size', '1.15rem').style('fill', 'var(--color-fg)').text(ordem === 'pol' ? f2(r.dp) : f2(r.media));
    });
  }

  // ---------- Dimensions ----------
  function drawDims(X, esc) {
    const box = $('dims'); box.classList.remove('dash-skeleton');
    const r = X.e.get(esc), g = X.e.get('geral');
    box.replaceChildren(...['programa', 'organizacao', 'instrutor'].map((k) => {
      const w = el('div', firstDraw ? 'sv-in' : '');
      const top = el('div', 'sv-dim-top'); top.append(el('span', 'sv-dim-name', dimName(k)));
      const v = mk(f2(r['media_' + k]), 'media_' + k, esc, 'sv-dim-val'); v.style.fontWeight = '400'; top.append(v);
      const bar = el('div', 'sv-dim-bar'); const fill = el('i'); fill.style.width = (r['otimo_' + k] ?? 0) + '%'; bar.append(fill);
      if (esc !== 'geral') { const m = el('em'); m.style.left = `calc(${g['otimo_' + k]}% - 1px)`; bar.append(m); }
      const sub = el('div', 'sv-dim-sub');
      const a = el('span'); a.append(mk(pct(r['otimo_' + k]), 'otimo_' + k, esc), t('dim_otimo'));
      const b = el('span');
      if (esc !== 'geral' && r['otimo_' + k] != null) { const diff = r['otimo_' + k] - g['otimo_' + k]; b.className = Math.abs(diff) < 0.05 ? '' : diff > 0 ? 'sv-good' : 'sv-bad'; b.textContent = sgn(diff, 1, t('pp')) + t('vs_geral'); }
      else b.textContent = t('dim_scale');
      sub.append(a, b); w.append(top, bar, sub);
      return w;
    }));
  }

  // ---------- Knowledge ----------
  function drawConh(X, esc) {
    const box = $('chart-matriz-conh'); box.classList.remove('dash-skeleton'); clearChart(box);
    const tip = tipFor(box);
    const rows = X.k.get(esc) || [];
    const distBox = $('kn-dist');
    if (!rows.length) { empty(box, t('no_know')); distBox.replaceChildren(); return; }
    const W = box.clientWidth; if (!W) return;
    const cell = new Map(rows.map((r) => [r.antes + '|' + r.apos, r]));
    const maxP = d3.max(rows, (r) => r.pct);
    const svg = d3.select(box).insert('svg', '.sv-tip').attr('width', '100%');
    const names = [0, 1, 2, 3, 4].map(noteName);
    const labL = d3.max(names, (n) => textW(svg, n, 'var(--cds-font-size-caption)')) + 34, labT = 46;
    const cs = Math.max(34, Math.min(70, (W - labL - 4) / 5));
    const H = labT + cs * 5 + 6, Wd = labL + cs * 5;
    svg.attr('viewBox', `0 0 ${Math.max(W, Wd)} ${H}`).attr('height', H);
    svg.append('text').attr('x', labL).attr('y', 12).style('font-size', 'var(--cds-font-size-caption)').style('fill', 'var(--color-fg-muted)').style('font-weight', 'var(--cds-font-weight-medium)').text(t('kn_after'));
    svg.append('text').attr('transform', `translate(10,${labT}) rotate(-90)`).attr('text-anchor', 'end').style('font-size', 'var(--cds-font-size-caption)').style('fill', 'var(--color-fg-muted)').style('font-weight', 'var(--cds-font-weight-medium)').text(t('kn_before'));
    names.forEach((n, i) => {
      svg.append('text').attr('x', labL + cs * i + cs / 2).attr('y', labT - 10).attr('text-anchor', 'middle').style('font-size', '11px').style('fill', 'var(--color-fg-muted)').text(n);
      svg.append('text').attr('x', labL - 8).attr('y', labT + cs * i + cs / 2 + 4).attr('text-anchor', 'end').style('font-size', 'var(--cds-font-size-caption)').style('fill', 'var(--color-fg-muted)').text(n);
    });
    for (let a = 1; a <= 5; a++) for (let d = 1; d <= 5; d++) {
      const c = cell.get(a + '|' + d), p = c ? c.pct : 0;
      const base = d > a ? 'var(--sv-accent)' : d < a ? 'var(--color-bad)' : 'var(--color-fg-muted)';
      const amt = p > 0 ? 10 + 80 * Math.sqrt(p / maxP) : 0;
      const xx = labL + cs * (d - 1), yy = labT + cs * (a - 1);
      svg.append('rect').attr('x', xx + 1.5).attr('y', yy + 1.5).attr('width', cs - 3).attr('height', cs - 3).attr('rx', 5)
        .style('fill', p > 0 ? `color-mix(in srgb, ${base} ${amt.toFixed(0)}%, var(--color-panel))` : 'color-mix(in srgb, var(--color-fg) 3%, var(--color-panel))')
        .style('stroke', a === d ? 'var(--cds-chart-axis)' : 'none').style('stroke-dasharray', a === d ? '3 2' : null)
        .on('mousemove', (ev) => showTip(box, tip, ev, t('kn_tip', { a: names[a - 1], d: names[d - 1] }), [`${fi(c ? c.fichas : 0)} (${pct(p)})`, d > a ? t('kn_up', { n: d - a }) : d < a ? t('kn_down') : t('kn_same')]))
        .on('mouseleave', () => hideTip(tip));
      if (p >= 0.5) svg.append('text').attr('x', xx + cs / 2).attr('y', yy + cs / 2 + 4).attr('text-anchor', 'middle').style('pointer-events', 'none').style('font-size', cs < 46 ? '10px' : 'var(--cds-font-size-caption)').style('font-weight', 'var(--cds-font-weight-medium)').style('fill', amt > 62 ? 'var(--color-bg)' : 'var(--color-fg)').text(f1(p) + '%');
    }
    const tot = d3.sum(rows, (r) => r.fichas);
    const marg = (key) => [1, 2, 3, 4, 5].map((v) => (d3.sum(rows.filter((r) => r[key] === v), (r) => r.fichas) / tot) * 100);
    const r0 = X.e.get(esc);
    distBox.replaceChildren(...[[t('kn_antes'), 'antes', r0.conhec_antes], [t('kn_apos'), 'apos', r0.conhec_apos]].map(([lbl, key, m]) => {
      const row = el('div', 'sv-dist-row'); row.append(el('span', '', lbl));
      const st = el('div', 'sv-stack');
      marg(key).forEach((v, i) => { if (v <= 0) return; const s = el('span'); s.style.width = v + '%'; s.style.background = NV[i]; st.append(s); });
      row.append(st, el('span', 'sv-num', f2(m)));
      return row;
    }));
    const lgd = el('div', 'sv-legend'); lgd.style.margin = '6px 0 0';
    names.forEach((n, i) => { const s = el('span'); const sw = el('i'); sw.style.background = NV[i]; s.append(sw, n); lgd.append(s); });
    distBox.append(lgd);
  }

  // ---------- Priority matrix ----------
  function drawPrioridade(X, esc) {
    const box = $('chart-prioridade'); box.classList.remove('dash-skeleton'); clearChart(box);
    const tip = tipFor(box);
    const rows = (X.i.get(esc) || []).filter((r) => r.correlacao != null && r.n > 0);
    if (rows.length < 3) { empty(box, t('prio_small')); return; }
    const W = box.clientWidth; if (!W) return;
    const H = 360, m = { t: 14, r: 16, b: 42, l: 46 };
    const svg = d3.select(box).insert('svg', '.sv-tip').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    const xe = d3.extent(rows, (c) => c.pct5), ye = d3.extent(rows, (c) => c.correlacao);
    const px = Math.max(1.5, (xe[1] - xe[0]) * 0.18), py = Math.max(0.02, (ye[1] - ye[0]) * 0.18);
    const x = d3.scaleLinear([xe[0] - px, xe[1] + px], [m.l, W - m.r]);
    const y = d3.scaleLinear([ye[0] - py, ye[1] + py], [H - m.b, m.t]);
    const mx = d3.mean(rows, (c) => c.pct5), my = d3.mean(rows, (c) => c.correlacao);
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', Math.max(0, x(mx) - m.l)).attr('height', Math.max(0, y(my) - m.t)).attr('rx', 6).style('fill', 'color-mix(in srgb, var(--color-bad) 9%, transparent)');
    svg.append('line').attr('x1', x(mx)).attr('x2', x(mx)).attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--cds-chart-reference)').attr('stroke-dasharray', '3 3');
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(my)).attr('y2', y(my)).style('stroke', 'var(--cds-chart-reference)').attr('stroke-dasharray', '3 3');
    const q = (tx, ty, anchor, txt, col) => svg.append('text').attr('x', tx).attr('y', ty).attr('text-anchor', anchor).style('font-size', '11px').style('letter-spacing', '.06em').style('text-transform', 'uppercase').style('fill', col).text(txt);
    q(m.l + 8, m.t + 16, 'start', t('q_prio'), 'var(--color-bad)');
    q(W - m.r - 6, m.t + 16, 'end', t('q_keep'), 'var(--color-fg-muted)');
    q(m.l + 8, H - m.b - 8, 'start', t('q_mon'), 'var(--color-fg-muted)');
    q(W - m.r - 6, H - m.b - 8, 'end', t('q_diff'), 'var(--color-fg-muted)');
    const xa = svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(Math.max(3, Math.floor(W / 90))).tickFormat((v) => loc(v, 0) + '%').tickSizeOuter(0));
    const ya = svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat((v) => f2(v)).tickSizeOuter(0));
    styleAxis(xa); styleAxis(ya);
    svg.append('text').attr('x', W - m.r).attr('y', H - 6).attr('text-anchor', 'end').style('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)').text(t('ax_exc'));
    svg.append('text').attr('transform', `translate(11,${m.t}) rotate(-90)`).attr('text-anchor', 'end').style('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)').text(t('ax_infl'));
    const isP = (c) => c.pct5 < mx && c.correlacao > my;
    const placed = rows.map((c) => ({ x: x(c.pct5) - 8, y: y(c.correlacao) + 8, w: 16, h: 16 }));
    rows.slice().sort((a, b) => y(a.correlacao) - y(b.correlacao)).forEach((c) => {
      const cx = x(c.pct5), cy = y(c.correlacao);
      const col = isP(c) ? 'var(--color-bad)' : c.pct5 >= mx ? 'var(--sv-accent)' : 'var(--color-fg-muted)';
      svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', isP(c) ? 7 : 5.5).style('fill', col).style('stroke', 'var(--color-panel)').style('stroke-width', 2)
        .on('mousemove', (ev) => showTip(box, tip, ev, `${qLabel(c.chave)} · ${dimName(c.dimensao)}`, [`${pct(c.pct5)} ${noteName(4)} · ${t('ax_mean')} ${f2(c.media)}`, `r = ${f2(c.correlacao)}`]))
        .on('mouseleave', () => hideTip(tip));
      const tt = svg.append('text').style('font-size', 'var(--cds-font-size-caption)').style('fill', 'var(--color-fg)').style('font-weight', isP(c) ? 'var(--cds-font-weight-medium)' : null).text(qLabel(c.chave));
      const tw = tt.node().getComputedTextLength();
      const hit = (a) => placed.some((p) => !(a.x + a.w < p.x || a.x > p.x + p.w || a.y - 11 > p.y || a.y < p.y - (p.h || 11)));
      const cands = [];
      [[1, 0], [-1, 0], [1, -13], [-1, -13], [1, 13], [-1, 13], [1, -26], [-1, -26], [1, 26], [-1, 26]].forEach(([s, dy]) => { const xx = s > 0 ? cx + 11 : cx - 11 - tw; if (xx >= m.l && xx + tw <= W - m.r) cands.push({ x: xx, y: cy + 4 + dy, w: tw }); });
      const pick = cands.find((cnd) => !hit(cnd)) || cands[0] || { x: cx + 11, y: cy + 4, w: tw };
      placed.push({ x: pick.x, y: pick.y, w: tw, h: 11 });
      tt.attr('x', pick.x).attr('y', pick.y);
    });
  }

  // ---------- Funnel (generic) ----------
  function funnel(box, pts, mu, sd, opts) {
    clearChart(box);
    const tip = tipFor(box);
    const W = box.clientWidth; if (!W || !pts.length) return;
    const H = opts.H || 360, m = { t: 14, r: 18, b: 42, l: 46 };
    const svg = d3.select(box).insert('svg', '.sv-tip').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    const nMin = Math.max(1, d3.min(pts, (p) => p.n)), nMax = Math.max(2, d3.max(pts, (p) => p.n));
    const x = d3.scaleLog([Math.max(1, nMin * 0.8), nMax * 1.25], [m.l, W - m.r]);
    const lo = (n, z) => mu - (z * sd) / Math.sqrt(n), hi = (n, z) => Math.min(5, mu + (z * sd) / Math.sqrt(n));
    const yMin = Math.max(1, Math.min(d3.min(pts, (p) => p.v) - 0.05, lo(x.domain()[0], 3.09)));
    const y = d3.scaleLinear([yMin, 5.02], [H - m.b, m.t]);
    const ns = d3.range(0, 101).map((i) => x.domain()[0] * Math.pow(x.domain()[1] / x.domain()[0], i / 100));
    const bandA = (z) => d3.area().x((n) => x(n)).y0((n) => y(Math.max(yMin, lo(n, z)))).y1((n) => y(hi(n, z)));
    svg.append('path').attr('d', bandA(3.09)(ns)).style('fill', 'color-mix(in srgb, var(--color-fg) 5%, transparent)');
    svg.append('path').attr('d', bandA(1.96)(ns)).style('fill', 'color-mix(in srgb, var(--color-fg) 7%, transparent)');
    [1.96, 3.09].forEach((z) => svg.append('path').attr('d', d3.line().x((n) => x(n)).y((n) => y(Math.max(yMin, lo(n, z))))(ns)).style('fill', 'none').style('stroke', 'var(--cds-chart-reference)').style('stroke-width', 1).attr('stroke-dasharray', z > 2 ? '2 3' : null));
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(mu)).attr('y2', y(mu)).style('stroke', 'var(--color-fg-muted)').attr('stroke-dasharray', '4 3');
    svg.append('text').attr('x', m.l + 6).attr('y', y(mu) - 6).style('font-size', 'var(--cds-font-size-caption)').style('fill', 'var(--color-fg-muted)').text(opts.meanLabel);
    const tv = [1, 2, 3, 5, 10, 20, 50, 100, 200, 500, 1000].filter((v) => v >= x.domain()[0] && v <= x.domain()[1]);
    const xa = svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickValues(tv).tickFormat((v) => fi(v)).tickSizeOuter(0));
    const ya = svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6).tickFormat((v) => f1(v)).tickSizeOuter(0));
    styleAxis(xa); styleAxis(ya);
    svg.append('text').attr('x', W - m.r).attr('y', H - 6).attr('text-anchor', 'end').style('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)').text(t('ax_forms_log'));
    svg.append('text').attr('transform', `translate(11,${m.t}) rotate(-90)`).attr('text-anchor', 'end').style('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)').text(t('ax_index'));
    const cls = (c) => (c.v < lo(c.n, 3.09) ? 'b2' : c.v < lo(c.n, 1.96) ? 'b1' : c.v > hi(c.n, 1.96) && hi(c.n, 1.96) < 5 ? 'g' : 'n');
    const col = { b2: 'var(--color-bad)', b1: 'var(--sv-n2)', g: 'var(--sv-accent)', n: 'color-mix(in srgb, var(--color-fg-muted) 70%, transparent)' };
    const sorted = pts.slice().sort((a, b) => (a.on ? 1 : 0) - (b.on ? 1 : 0));
    sorted.forEach((c) => {
      const k = cls(c);
      svg.append('circle').attr('cx', x(c.n)).attr('cy', y(c.v)).attr('r', c.sel ? 8 : 5.5)
        .style('fill', col[k]).style('opacity', c.on ? 1 : 0.18).style('stroke', c.sel ? 'var(--color-fg)' : 'var(--color-panel)').style('stroke-width', c.sel ? 2.5 : 1.5).style('cursor', 'pointer')
        .on('mousemove', (ev) => showTip(box, tip, ev, c.title, [t('tip_forms_idx', { n: fi(c.n), i: f2(c.v) }), t('tip_otimo', { v: pct(c.ot) }), t('f_' + k)]))
        .on('mouseleave', () => hideTip(tip))
        .on('click', () => drill(c.row));
    });
    const placed = [];
    sorted.filter((c) => c.on && (cls(c) === 'b2' || cls(c) === 'b1' || c.sel || opts.labelAll)).forEach((c) => {
      const cx = x(c.n), cy = y(c.v);
      const tt = svg.append('text').style('font-size', '11px').style('fill', 'var(--color-fg)').style('pointer-events', 'none').text(c.short);
      const tw = tt.node().getComputedTextLength();
      let tx = cx + 9 + tw < W - m.r ? cx + 9 : cx - 9 - tw, ty = cy + 4, tries = 0;
      while (placed.some((q) => Math.abs(q.y - ty) < 11 && !(tx + tw < q.x || tx > q.x + q.w)) && tries < 6) { ty += 11; tries++; }
      placed.push({ x: tx, y: ty, w: tw });
      tt.attr('x', tx).attr('y', ty);
    });
    return cls;
  }
  const funnelClass = (mu, sd) => (c) => { const lo = (n, z) => mu - (z * sd) / Math.sqrt(n); return c.indice < lo(c.preenchidas, 3.09) ? 'b2' : c.indice < lo(c.preenchidas, 1.96) ? 'b1' : 'n'; };
  function drawFunil(X, esc) {
    const box = $('chart-funil'); box.classList.remove('dash-skeleton');
    const g = X.e.get('geral'), r0 = X.e.get(esc);
    const sel = r0.nivel === 'curso' || r0.nivel === 'turma' ? r0.sigla : null;
    const pts = [...X.e.values()].filter((r) => r.nivel === 'curso' && r.preenchidas > 0 && r.indice != null).map((r) => ({
      n: r.preenchidas, v: r.indice, ot: r.pct_otimo, row: r, title: `${r.sigla} · ${cname(X, r.sigla)}`, short: r.sigla, sel: r.sigla === sel, on: r0.nivel === 'geral' ? true : r.area === r0.area,
    }));
    funnel(box, pts, g.indice, g.dp_indice, { meanLabel: t('mean_all', { v: f2(g.indice) }) });
  }

  // ---------- Classes consistency ----------
  function drawTurmas(X, esc) {
    const box = $('chart-turmas'); box.classList.remove('dash-skeleton'); clearChart(box);
    const r0 = X.e.get(esc);
    const tmin = Math.max(3, minN());
    if (r0.nivel === 'curso' || r0.nivel === 'turma') {
      const course = r0.nivel === 'curso' ? r0 : X.e.get(r0.pai);
      $('turmas-title').textContent = t('c_turmas_one', { c: course.sigla });
      $('turmas-note').textContent = t('c_turmas_one_n');
      const ts = (X.kids.get(course.escopo) || []).filter((x) => x.preenchidas > 0 && x.indice != null);
      if (ts.length < 2) { empty(box, t('turmas_one_few')); return; }
      const pts = ts.map((r) => ({ n: r.preenchidas, v: r.indice, ot: r.pct_otimo, row: r, title: rowFull(X, r), short: 'T' + r.turma, sel: r.escopo === esc, on: true }));
      funnel(box, pts, course.indice, course.dp_indice || X.e.get('geral').dp_indice, { meanLabel: t('course_mean', { v: f2(course.indice) }), labelAll: ts.length <= 25, H: 340 });
      return;
    }
    $('turmas-title').textContent = t('c_turmas_all');
    $('turmas-note').textContent = t('c_turmas_all_n', { n: tmin });
    const courses = compRows(X, esc).map((c) => {
      const ts = (X.kids.get(c.escopo) || []).filter((x) => x.preenchidas >= tmin && x.indice != null);
      return { c, ts, amp: ts.length ? d3.max(ts, (x) => x.indice) - d3.min(ts, (x) => x.indice) : 0 };
    }).filter((d) => d.ts.length >= 3).sort((a, b) => b.amp - a.amp);
    if (!courses.length) { empty(box, t('turmas_none')); return; }
    const tip = tipFor(box);
    const W = box.clientWidth; if (!W) return;
    const svg = d3.select(box).insert('svg', '.sv-tip').attr('width', '100%');
    const narrow = W < 640;
    const labW = narrow ? 0 : Math.min(320, d3.max(courses, (d) => textW(svg, d.c.sigla + ' · ' + cname(X, d.c.sigla), 'var(--cds-font-size-caption)')) + 16);
    const ampW = 70, rowH = narrow ? 44 : 30, top = 26;
    const allV = courses.flatMap((d) => d.ts.map((x) => x.indice));
    const x = d3.scaleLinear([Math.max(1, Math.floor((d3.min(allV) - 0.05) * 10) / 10), 5], [labW + 8, W - ampW - 10]);
    const H = top + courses.length * rowH + 6;
    svg.attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    x.ticks(6).forEach((v) => {
      svg.append('line').attr('x1', x(v)).attr('x2', x(v)).attr('y1', top - 6).attr('y2', H - 4).style('stroke', 'var(--cds-chart-grid)');
      svg.append('text').attr('x', x(v)).attr('y', 12).attr('text-anchor', 'middle').style('font-size', 'var(--cds-font-size-caption)').style('fill', 'var(--color-fg-muted)').text(f1(v));
    });
    svg.append('text').attr('x', W).attr('y', 12).attr('text-anchor', 'end').style('font-size', 'var(--cds-font-size-caption)').style('fill', 'var(--color-fg-muted)').text(t('amp'));
    courses.forEach((d, i) => {
      const yy = top + i * rowH + (narrow ? 30 : rowH / 2);
      const g = svg.append('g').style('cursor', 'pointer').on('click', () => drill(d.c));
      g.append('rect').attr('x', 0).attr('y', yy - rowH / 2 - (narrow ? 8 : 0)).attr('width', W).attr('height', rowH).style('fill', 'transparent');
      const name = d.c.sigla + ' · ' + cname(X, d.c.sigla);
      const lbl = g.append('text').attr('x', 0).attr('y', narrow ? yy - 14 : yy + 4).style('font-size', 'var(--cds-font-size-caption)').style('fill', 'var(--color-fg)').text(name);
      { const maxW = narrow ? W - 4 : labW - 12; let s = name; while (lbl.node().getComputedTextLength() > maxW && s.length > 8) { s = s.slice(0, -2); lbl.text(s + '…'); } }
      const mn = d3.min(d.ts, (q) => q.indice), mxv = d3.max(d.ts, (q) => q.indice);
      g.append('line').attr('x1', x(mn)).attr('x2', x(mxv)).attr('y1', yy).attr('y2', yy).style('stroke', 'var(--cds-chart-axis)').style('stroke-width', 2);
      if (d.c.indice != null) g.append('line').attr('x1', x(d.c.indice)).attr('x2', x(d.c.indice)).attr('y1', yy - 7).attr('y2', yy + 7).style('stroke', 'var(--color-fg)').style('stroke-width', 2);
      d.ts.forEach((q) => {
        g.append('circle').attr('cx', x(q.indice)).attr('cy', yy).attr('r', 5).style('fill', HB[Math.max(0, band(q.indice, 'media'))]).style('stroke', 'var(--color-panel)').style('stroke-width', 1.5)
          .on('mousemove', (ev) => showTip(box, tip, ev, name, [`${t('turma_x', { t: q.turma })} · ${t('tip_forms_idx', { n: fi(q.preenchidas), i: f2(q.indice) })}`, t('tip_otimo', { v: pct(q.pct_otimo) })]))
          .on('mouseleave', () => hideTip(tip))
          .on('click', (ev) => { ev.stopPropagation(); drill(q); });
      });
      g.append('text').attr('x', W).attr('y', yy + 4).attr('text-anchor', 'end').style('font-size', 'var(--cds-font-size-caption)').style('font-weight', 'var(--cds-font-weight-medium)').style('fill', d.amp >= 0.5 ? 'var(--color-bad)' : 'var(--color-fg)').text(f2(d.amp));
    });
  }

  // ---------- Participation ----------
  const CSVD = {};
  function drawParticipacao(X, esc) {
    const box = $('part-list'); box.classList.remove('dash-skeleton');
    const rows = partRows(X, esc).slice().sort((a, b) => (a.taxa_resposta ?? -1) - (b.taxa_resposta ?? -1) || b.fichas - a.fichas);
    const lvl = rows[0]?.nivel;
    $('part-title').textContent = t('c_part', { u: lvl === 'area' ? t('u_area') : lvl === 'curso' ? t('u_curso') : t('u_turma') });
    $('lg-part').replaceChildren(...[[t('st_pre'), 'var(--sv-accent)'], [t('st_nao'), 'var(--sv-n3)'], [t('st_fal'), 'var(--sv-n2)']].map(([tx, c]) => { const s = el('span'); const sw = el('i'); sw.style.background = c; s.append(sw, tx); return s; }));
    CSVD['part-list'] = { header: [t(lvl === 'area' ? 'col_area' : lvl === 'curso' ? 'col_curso' : 'col_turma'), t('col_fichas'), t('st_pre'), t('st_nao'), t('st_fal'), t('k_taxa') + ' (%)'], rows: rows.map((r) => [rowFull(X, r), r.fichas, r.preenchidas, r.nao_preenchidas, r.faltosos, r.taxa_resposta]) };
    if (!rows.length) { box.replaceChildren(el('div', 'sv-empty', '—')); return; }
    const card = $('card-participacao');
    box.replaceChildren(...rows.map((r) => {
      const row = el('div', 'sv-part-row' + (r.escopo === esc ? ' sv-cur' : ''));
      const nm = el('div', 'sv-part-name');
      nm.append(rowFull(X, r), el('small', '', t('n_forms', { n: fi(r.fichas) })));
      const st = el('div', 'sv-stack');
      [[r.preenchidas, 'var(--sv-accent)'], [r.nao_preenchidas, 'var(--sv-n3)'], [r.faltosos, 'var(--sv-n2)']].forEach(([v, c]) => { if (!v) return; const s = el('span'); s.style.width = (v / r.fichas) * 100 + '%'; s.style.background = c; st.append(s); });
      const rate = el('div', 'sv-part-rate' + (r.taxa_resposta != null && r.taxa_resposta < 50 ? ' sv-bad' : ''), pct(r.taxa_resposta));
      row.append(nm, st, rate);
      row.addEventListener('click', () => drill(r));
      row.addEventListener('mousemove', (ev) => showTip(card, tipFor(card), ev, rowFull(X, r), [['var(--sv-accent)', `${t('st_pre')}: ${fi(r.preenchidas)}`], ['var(--sv-n3)', `${t('st_nao')}: ${fi(r.nao_preenchidas)}`], ['var(--sv-n2)', `${t('st_fal')}: ${fi(r.faltosos)} (${pct(r.taxa_ausencia)})`]]));
      row.addEventListener('mouseleave', () => hideTip(tipFor(card)));
      return row;
    }));
  }

  // ---------- Heatmap ----------
  const thLabel = (txt, tipKey, cls) => { const th = el('th', cls || ''); const w = el('span', 'sv-th'); w.append(txt); if (tipKey) w.append(infoBtn(tipKey)); th.append(w); return th; };
  function heatLegend(metr) {
    const sc = $('heat-scale');
    if (UI.cfg.mode === 'abs') {
      const th = metr === 'media' ? UI.cfg.thrMean : UI.cfg.thrOt;
      const fmt = (v) => (metr === 'media' ? f2(v) : loc(v, 0) + '%');
      const items = [[0, `< ${fmt(th[0])}`], [1, `${fmt(th[0])}–${fmt(th[1])}`], [2, `${fmt(th[1])}–${fmt(th[2])}`], [3, `≥ ${fmt(th[2])}`]];
      sc.replaceChildren(...items.map(([b, r]) => { const s = el('span'); const sw = el('i'); sw.style.background = `color-mix(in srgb, ${HB[b]} 52%, transparent)`; s.append(sw, `${t('band_' + (b + 1))} ${r}`); return s; }));
    } else {
      const g = el('span', 'sv-grad'); g.style.background = `linear-gradient(90deg, color-mix(in srgb, ${HB[0]} 64%, transparent), transparent 50%, color-mix(in srgb, ${HB[3]} 64%, transparent))`;
      sc.replaceChildren(el('span', '', t('lg_below')), g, el('span', '', t('lg_above')));
    }
    return sc;
  }
  function drawHeat(X, esc) {
    const wrap = $('heat-wrap'); wrap.classList.remove('dash-skeleton');
    const p = P(), mN = minN(), metr = p.metrica || 'media';
    const all = compRows(X, esc).filter((r) => r.preenchidas > 0);
    const rows = all.filter((r) => r.preenchidas >= mN).sort((a, b) => (metr === 'media' ? b.indice - a.indice : b.pct_otimo - a.pct_otimo));
    const sc = heatLegend(metr);
    const hidden = all.length - rows.length;
    const isT = all[0]?.nivel === 'turma';
    if (hidden > 0) sc.append(el('span', '', t('heat_hidden', { n: hidden, u: t(isT ? (hidden > 1 ? 'u_turmas' : 'u_turma') : (hidden > 1 ? 'u_cursos' : 'u_curso')), m: mN })));
    const mLabel = metr === 'media' ? t('heat_mean_lbl') : t('heat_otimo_lbl');
    $('heat-note').textContent = UI.cfg.mode === 'abs' ? t('heat_abs', { m: mLabel }) : t('heat_rel', { m: mLabel, s: metr === 'media' ? f2(UI.cfg.spanMean) : loc(UI.cfg.spanOt, 0) + (Li() ? ' pp' : ' p.p.') });
    if (!rows.length) { wrap.replaceChildren(el('div', 'sv-empty', t('heat_none'))); CSVD['heat-wrap'] = null; return; }
    const ref = new Map((X.i.get('geral') || []).map((r) => [r.chave, r])), g = X.e.get('geral');
    const keys = [...ref.keys()];
    const val = (it) => (it ? (metr === 'media' ? it.media : it.pct5) : null);
    const fmt = (v) => (v == null ? '—' : metr === 'media' ? f2(v) : loc(v, 0) + '%');
    const tbl = el('table', 'sv-heat');
    const thead = el('thead');
    const h1 = el('tr'); h1.append(el('th'), el('th'), el('th'));
    [['programa', 3], ['organizacao', 4], ['instrutor', 3]].forEach(([n, c]) => { const th = el('th', '', dimName(n)); th.colSpan = c; th.style.borderBottom = '1px solid var(--color-border-line)'; th.style.position = 'static'; h1.append(th); });
    [...h1.children].slice(0, 3).forEach((th) => { th.style.position = 'static'; });
    const h2 = el('tr');
    h2.append(thLabel(isT ? t('col_turma') : t('col_curso')), thLabel(t('col_fichas'), 'fichas'), thLabel(metr === 'media' ? t('col_indice') : t('col_otimo_geral'), metr === 'media' ? 'indice' : 'otimo'));
    keys.forEach((k) => h2.append(thLabel(qShort(k), 'q:' + k)));
    thead.append(h1, h2);
    const tb = el('tbody');
    const gi = metr === 'media' ? g.indice : g.pct_otimo;
    const csvRows = [];
    rows.forEach((r) => {
      const tr = el('tr', r.escopo === esc ? 'sv-cur' : '');
      const its = new Map((X.i.get(r.escopo) || []).map((x) => [x.chave, x]));
      const nm = el('td', '', rowFull(X, r)); nm.title = nm.textContent;
      const iv = metr === 'media' ? r.indice : r.pct_otimo;
      const idx = el('td', 'sv-heat-idx', fmt(iv)); idx.style.background = cellFill(iv, gi, metr);
      tr.append(nm, el('td', '', fi(r.preenchidas)), idx);
      const vals = keys.map((k) => val(its.get(k)));
      keys.forEach((k, j) => { const v = vals[j]; const td = el('td', '', fmt(v)); td.style.background = cellFill(v, val(ref.get(k)), metr); tr.append(td); });
      tr.addEventListener('click', () => drill(r));
      tb.append(tr);
      csvRows.push([rowFull(X, r), r.preenchidas, iv, ...vals]);
    });
    const refRow = el('tr'); refRow.style.cursor = 'default';
    const rn = el('td', '', t('ref_row')); rn.style.color = 'var(--color-fg-muted)';
    refRow.append(rn, el('td', '', fi(g.preenchidas)), el('td', 'sv-heat-idx', fmt(gi)));
    keys.forEach((k) => refRow.append(el('td', '', fmt(val(ref.get(k))))));
    [...refRow.children].forEach((td) => { td.style.borderTop = '1px solid var(--color-border-line)'; td.style.borderRadius = '0'; });
    tb.append(refRow);
    tbl.append(thead, tb);
    wrap.replaceChildren(tbl);
    CSVD['heat-wrap'] = { header: [isT ? t('col_turma') : t('col_curso'), t('col_fichas'), metr === 'media' ? t('col_indice') : t('col_otimo_geral'), ...keys.map(qLabel)], rows: csvRows.concat([[t('ref_row'), g.preenchidas, gi, ...keys.map((k) => val(ref.get(k)))]]) };
  }

  // ---------- Ranking ----------
  const sortState = { key: 'indice', dir: 'desc' };
  let search = '';
  $('rank-search').addEventListener('input', (e) => { search = e.target.value.trim().toLowerCase(); if (IDX) drawRanking(IDX, escopoAtual(IDX)); });
  const COLS = [
    { f: 'rotulo', t: 'col_curso', type: 's' },
    { f: 'area', t: 'col_area', type: 's', opt: true, tip: 'area' },
    { f: 'preenchidas', t: 'col_fichas', type: 'n', r: true, tip: 'fichas' },
    { f: 'taxa_resposta', t: 'col_resp', type: 'n', r: true, opt: true, tip: 'taxa' },
    { f: 'indice', t: 'col_indice', type: 'n', tip: 'indice' },
    { f: 'pct_otimo', t: 'm_otimo', type: 'n', r: true, tip: 'otimo' },
    { f: 'ganho', t: 'col_ganho', type: 'n', r: true, opt: true, tip: 'ganho' },
    { f: 'item_mais_fraco', t: 'col_fraca', type: 's', opt: true, tip: 'fraca' },
  ];
  function drawRanking(X, esc) {
    const wrap = $('rank-wrap'); wrap.classList.remove('dash-skeleton');
    const mN = minN();
    const all = compRows(X, esc).filter((r) => r.preenchidas > 0);
    const lvlT = all[0]?.nivel === 'turma';
    const r0 = X.e.get(esc);
    $('rank-title').textContent = lvlT ? t('c_rank_t', { c: r0.sigla }) : r0.nivel === 'area' ? t('c_rank_area', { a: r0.area }) : t('c_rank');
    let rows = all.filter((r) => r.preenchidas >= mN);
    if (search) rows = rows.filter((r) => (rowName(X, r) + ' ' + r.rotulo + ' ' + r.sigla + ' ' + r.area).toLowerCase().includes(search));
    const c = COLS.find((x) => x.f === sortState.key);
    const sv = (r, f) => (f === 'rotulo' ? (lvlT ? r.turma : rowName(X, r)) : f === 'item_mais_fraco' ? (r[f] ? qLabel(r[f]) : null) : r[f]);
    rows.sort((a, b) => { const va = sv(a, c.f), vb = sv(b, c.f); if (va == null) return 1; if (vb == null) return -1; const o = c.type === 'n' || (c.f === 'rotulo' && lvlT) ? va - vb : String(va).localeCompare(String(vb), LOC(), { numeric: true }); return sortState.dir === 'asc' ? o : -o; });
    $('rank-head').replaceChildren(...COLS.map((col) => {
      const th = el('th', (col.r ? 'r ' : '') + (col.opt ? 'sv-opt' : '')); th.dataset.field = col.f;
      if (sortState.key === col.f) th.setAttribute('aria-sort', sortState.dir === 'asc' ? 'ascending' : 'descending');
      const w = el('span', 'sv-th');
      const b = el('button', 'sv-sort', (col.f === 'rotulo' && lvlT ? t('col_turma') : t(col.t)) + (sortState.key === col.f ? (sortState.dir === 'asc' ? ' ↑' : ' ↓') : ''));
      b.type = 'button';
      b.addEventListener('click', () => { if (sortState.key === col.f) sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc'; else { sortState.key = col.f; sortState.dir = col.type === 'n' ? 'desc' : 'asc'; } drawRanking(IDX, escopoAtual(IDX)); });
      w.append(b); if (col.tip) w.append(infoBtn(col.tip));
      th.append(w); return th;
    }));
    const vals = all.map((r) => r.indice).filter((v) => v != null);
    const lo = Math.max(1, Math.floor((d3.min(vals) - 0.1) * 10) / 10);
    $('rank-body').replaceChildren(...rows.map((r) => {
      const tr = el('tr', r.escopo === esc ? 'sv-cur' : ''); tr.dataset.key = r.escopo;
      const nm = el('td'); const d = el('div', 'sv-cell-name', rowName(X, r)); if (r.nivel === 'curso') d.append(el('small', '', r.sigla)); nm.append(d); nm.title = rowName(X, r);
      const ib = el('td'); const bx = el('div', 'sv-inbar'); const tr2 = el('span'); const fl = el('i'); fl.style.width = (((r.indice ?? lo) - lo) / (5 - lo)) * 100 + '%'; fl.style.background = HB[Math.max(0, band(r.indice, 'media'))]; tr2.append(fl); bx.append(el('b', 'sv-num', f2(r.indice)), tr2); ib.append(bx);
      const tx = el('td', 'r sv-opt' + (r.taxa_resposta != null && r.taxa_resposta < 50 ? ' sv-bad' : ''), pct(r.taxa_resposta));
      const fw = el('td', 'sv-opt'); fw.textContent = r.item_mais_fraco ? `${qLabel(r.item_mais_fraco)} · ${loc(r.otimo_item_mais_fraco, 0)}%` : '—';
      tr.append(nm, el('td', 'sv-opt', r.area), el('td', 'r', fi(r.preenchidas)), tx, ib, el('td', 'r', pct(r.pct_otimo)), el('td', 'r sv-opt', r.ganho == null ? '—' : sgn(r.ganho, 2)), fw);
      tr.addEventListener('click', () => drill(r));
      return tr;
    }));
    const hidden = all.length - all.filter((r) => r.preenchidas >= mN).length;
    $('rank-foot').textContent = t('rank_foot', { n: rows.length, u: t(lvlT ? 'u_turmas' : 'u_cursos') }) + (hidden ? t('rank_hidden', { n: hidden, m: mN }) : '');
    CSVD['rank-wrap'] = { header: [lvlT ? t('col_turma') : t('col_curso'), 'Sigla', t('col_area'), t('col_fichas'), t('col_resp') + ' (%)', t('col_indice'), t('m_otimo'), t('col_ganho'), t('col_fraca')], rows: rows.map((r) => [rowName(X, r), r.sigla, r.area, r.preenchidas, r.taxa_resposta, r.indice, r.pct_otimo, r.ganho, r.item_mais_fraco ? qLabel(r.item_mais_fraco) : '']) };
  }

  // ---------- Quality ----------
  function drawQualidade(Q) {
    const box = $('qual-cards'); box.classList.remove('dash-skeleton');
    const pc = (a, b) => (b ? f1((a / b) * 100) + '%' : '—');
    const listShort = (s) => { const a = s ? s.split(', ') : []; return a.length > 6 ? a.slice(0, 6).join(', ') + (Li() ? ` and ${a.length - 6} more` : ` e mais ${a.length - 6}`) : a.join(', ') || '—'; };
    box.replaceChildren(...Q.map((q) => {
      const def = I.QUAL[q.indicador]; if (!def) return el('div');
      const [label, tpl] = def[Li()];
      const val = q.indicador === 'teto' ? pct(q.valor) : fi(q.valor);
      const detail = tpl.replace('{p}', fi(q.base)).replace('{n}', fi(q.extra)).replace('{f}', fi(q.extra2)).replace('{pct}', pc(q.valor, q.base)).replace('{b}', fi(q.base)).replace('{x}', fi(q.extra)).replace('{lista}', listShort(q.lista));
      const c = el('div', 'sv-qcard'); c.dataset.key = q.indicador;
      const v = el('div', 'sv-qv', val);
      if (['faltosos_resp', 'sem_fichas', 'sem_nome'].includes(q.indicador) && q.valor > 0) v.classList.add('sv-bad');
      c.append(v, el('div', 'sv-ql', label), el('div', 'sv-qd', detail));
      return c;
    }));
  }

  // ---------- Executive reading ----------
  function drawExec(X, esc) {
    const r = X.e.get(esc), g = X.e.get('geral');
    const its = (X.i.get(esc) || []).filter((x) => x.n > 0);
    const en = Li() === 1;
    const li = (parts) => { const l = el('li'); para(l, parts); return l; };
    const mi = (text, field, it, cls) => { const b = el('b', cls, text); b.dataset.source = 'itens'; b.dataset.field = field; b.dataset.where = 'escopo=' + enc(esc) + '&chave=' + enc(it.chave); return b; };
    const B = (s, cls) => el('b', cls, s);
    ['ex-fortes', 'ex-atencao', 'ex-acoes'].forEach((id) => $(id).classList.remove('dash-skeleton'));
    if (!its.length) {
      $('ex-fortes').replaceChildren(li([en ? 'No completed forms in this scope.' : 'Sem fichas preenchidas neste recorte.']));
      $('ex-atencao').replaceChildren(li(en ? ['Of ', mk(fi(r.fichas), 'fichas', esc), ' forms on record, ', mk(fi(r.nao_preenchidas), 'nao_preenchidas', esc), ' were not completed.'] : ['Das ', mk(fi(r.fichas), 'fichas', esc), ' fichas registradas, ', mk(fi(r.nao_preenchidas), 'nao_preenchidas', esc), ' não foram preenchidas.']));
      $('ex-acoes').replaceChildren(li([en ? 'Collect the pending forms before assessing this scope.' : 'Recolher as fichas pendentes antes de avaliar este recorte.']));
      return;
    }
    const byOt = [...its].sort((a, b) => b.pct5 - a.pct5);
    const fortes = [];
    fortes.push(li(en ? [B(qLabel(byOt[0].chave)), ' and ', B(qLabel(byOt[1].chave)), ' lead, with ', mi(pct(byOt[0].pct5), 'pct5', byOt[0]), ' and ', mi(pct(byOt[1].pct5), 'pct5', byOt[1]), ' "Excellent".']
      : [B(qLabel(byOt[0].chave)), ' e ', B(qLabel(byOt[1].chave)), ' lideram, com ', mi(pct(byOt[0].pct5), 'pct5', byOt[0]), ' e ', mi(pct(byOt[1].pct5), 'pct5', byOt[1]), ' de "Ótimo".']));
    const dims = ['programa', 'organizacao', 'instrutor'].map((k) => ({ k, v: r['otimo_' + k] })).filter((d) => d.v != null).sort((a, b) => b.v - a.v);
    if (dims.length) { const d = dims[0]; fortes.push(li(en ? ['The best-rated dimension is ', B(dimName(d.k)), ' (', mk(pct(d.v), 'otimo_' + d.k, esc), ' Excellent, mean ', mk(f2(r['media_' + d.k]), 'media_' + d.k, esc), ').'] : ['A dimensão mais bem avaliada é ', B(dimName(d.k)), ' (', mk(pct(d.v), 'otimo_' + d.k, esc), ' Ótimo, média ', mk(f2(r['media_' + d.k]), 'media_' + d.k, esc), ').'])); }
    if (r.ganho != null) fortes.push(li(en ? ['Perceived learning: ', mk(pct(r.pct_evoluiu), 'pct_evoluiu', esc), ' reported improvement, with a mean gain of ', mk(sgn(r.ganho, 2), 'ganho', esc), ' points on the 5-point scale.'] : ['Aprendizagem percebida: ', mk(pct(r.pct_evoluiu), 'pct_evoluiu', esc), ' declararam evolução, com ganho médio de ', mk(sgn(r.ganho, 2), 'ganho', esc), ' ponto na escala de 5.']));
    if (esc !== 'geral' && r.indice > g.indice + 0.05) fortes.push(li(en ? ['Index above the overall mean: ', mk(f2(r.indice), 'indice', esc), ' vs. ', mk(f2(g.indice), 'indice', 'geral'), '.'] : ['Índice acima da média geral: ', mk(f2(r.indice), 'indice', esc), ' contra ', mk(f2(g.indice), 'indice', 'geral'), '.']));
    $('ex-fortes').replaceChildren(...fortes);

    const at = [];
    const w = byOt[byOt.length - 1], w2 = byOt[byOt.length - 2];
    at.push(li(en ? [B(qLabel(w.chave)), ' is the question furthest from excellence: ', mi(pct(w.pct5), 'pct5', w), ' "Excellent" and ', mi(pct(w.pct_ate_bom), 'pct_ate_bom', w), ' of scores "Good" or lower. Next comes ', B(qLabel(w2.chave)), ' (', mi(pct(w2.pct5), 'pct5', w2), ').']
      : [B(qLabel(w.chave)), ' é a pergunta mais distante da excelência: ', mi(pct(w.pct5), 'pct5', w), ' de "Ótimo" e ', mi(pct(w.pct_ate_bom), 'pct_ate_bom', w), ' das notas em "Bom" ou abaixo. Logo atrás vem ', B(qLabel(w2.chave)), ' (', mi(pct(w2.pct5), 'pct5', w2), ').']));
    const pol = [...its].sort((a, b) => (b.dp ?? 0) - (a.dp ?? 0))[0];
    if (pol && pol.dp != null && pol.dp >= 0.65) at.push(li(en ? ['Most divided opinions: ', B(qLabel(pol.chave)), ' (std. dev. ', mi(f2(pol.dp), 'dp', pol), ').'] : ['Opiniões mais divididas: ', B(qLabel(pol.chave)), ' (desvio ', mi(f2(pol.dp), 'dp', pol), ').']));
    if (r.taxa_resposta != null && r.taxa_resposta < 70) at.push(li(en ? ['Incomplete collection: only ', mk(pct(r.taxa_resposta), 'taxa_resposta', esc, 'sv-bad'), ' of expected forms came back completed (', mk(fi(r.nao_preenchidas), 'nao_preenchidas', esc), ' blank). Results may not represent the whole class.'] : ['Coleta incompleta: só ', mk(pct(r.taxa_resposta), 'taxa_resposta', esc, 'sv-bad'), ' das fichas esperadas voltaram preenchidas (', mk(fi(r.nao_preenchidas), 'nao_preenchidas', esc), ' em branco). Os resultados podem não representar a turma inteira.']));
    if (r.taxa_ausencia != null && r.taxa_ausencia >= 10) at.push(li(en ? ['Significant absence: ', mk(pct(r.taxa_ausencia), 'taxa_ausencia', esc), ' of forms belong to absent students (', mk(fi(r.faltosos), 'faltosos', esc), ').'] : ['Ausência relevante: ', mk(pct(r.taxa_ausencia), 'taxa_ausencia', esc), ' das fichas são de alunos faltosos (', mk(fi(r.faltosos), 'faltosos', esc), ').']));
    if (r.pct_nota_maxima != null && r.pct_nota_maxima >= 50) at.push(li(en ? ['Ceiling effect: ', mk(pct(r.pct_nota_maxima), 'pct_nota_maxima', esc), ' of forms marked "Excellent" on everything. Track % Excellent and comments, not just the mean.'] : ['Efeito teto: ', mk(pct(r.pct_nota_maxima), 'pct_nota_maxima', esc), ' das fichas marcaram "Ótimo" em tudo. Vale acompanhar % Ótimo e comentários, não só a média.']));
    if (r.nivel === 'geral' || r.nivel === 'area') {
      const cf = funnelClass(g.indice, g.dp_indice);
      const out = compRows(X, esc).filter((c) => c.preenchidas > 0 && c.indice != null && cf(c) === 'b2');
      if (out.length) at.push(li([String(out.length), en ? (out.length > 1 ? ' courses fall' : ' course falls') + ' below the 99.8% control limit: ' : (out.length > 1 ? ' cursos ficam' : ' curso fica') + ' abaixo do limite de controle de 99,8% no funil: ', ...out.slice(0, 4).flatMap((c, i) => [i ? ', ' : '', mk(c.sigla, 'sigla', c.escopo), ' (', mk(f2(c.indice), 'indice', c.escopo), ')']), out.length > 4 ? (en ? ' and others.' : ' e outros.') : '.']));
    }
    $('ex-atencao').replaceChildren(...at);

    const ac = [];
    const cor = its.filter((x) => x.correlacao != null);
    if (cor.length >= 3) {
      const mx = d3.mean(cor, (c) => c.pct5), my = d3.mean(cor, (c) => c.correlacao);
      const pri = cor.filter((c) => c.pct5 < mx && c.correlacao > my).sort((a, b) => a.pct5 - b.pct5);
      if (pri.length) ac.push(li(en ? ['Prioritize ', ...pri.slice(0, 2).flatMap((c, i) => [i ? ' and ' : '', B(qLabel(c.chave))]), ': below the excellence average and among the questions that move most with overall perception (r = ', mi(f2(pri[0].correlacao), 'correlacao', pri[0]), ').']
        : ['Priorizar ', ...pri.slice(0, 2).flatMap((c, i) => [i ? ' e ' : '', B(qLabel(c.chave))]), ': ', pri.length > 1 ? 'estão' : 'está', ' abaixo da média de excelência e entre as que mais se movem junto com a percepção geral (r = ', mi(f2(pri[0].correlacao), 'correlacao', pri[0]), ').']));
    }
    if (w.dimensao === 'programa') ac.push(li(en ? ['Review program design (', B(qLabel(w.chave)), '): more guided practice, exercises tied to the workstation, and material aligned with content.'] : ['Rever o desenho do programa (', B(qLabel(w.chave)), '): mais prática guiada, exercícios aplicados ao posto de trabalho e material alinhado ao conteúdo.']));
    else if (w.dimensao === 'organizacao') ac.push(li(en ? ['Tackle logistics (', B(qLabel(w.chave)), '): room and equipment checklist, and advance communication with classes.'] : ['Atacar a logística (', B(qLabel(w.chave)), '): checklist de sala, equipamentos e comunicação prévia com as turmas.']));
    else ac.push(li(en ? ['Support instructors on ', B(qLabel(w.chave)), ' with class observation and peer exchanges.'] : ['Apoiar os instrutores em ', B(qLabel(w.chave)), ' com observação de aula e trocas entre pares.']));
    const kids = partRows(X, esc).filter((c) => c.preenchidas + c.nao_preenchidas >= 20 && c.taxa_resposta != null).sort((a, b) => a.taxa_resposta - b.taxa_resposta);
    if (kids.length && kids[0].taxa_resposta < 60) ac.push(li([en ? 'Recover collection where it is lowest: ' : 'Recuperar a coleta onde ela é mais baixa: ', ...kids.slice(0, 3).flatMap((c, i) => [i ? ', ' : '', B(c.nivel === 'curso' ? c.sigla : rowName(X, c)), ' (', mk(pct(c.taxa_resposta), 'taxa_resposta', c.escopo), ')']), en ? '. Handing out the form at the end of the last session, before people leave, usually raises the rate.' : '. Aplicar a ficha ao fim da última aula, antes da saída, costuma elevar a taxa.']));
    if (r.pct_nota_maxima >= 50) ac.push(li([en ? 'Add a mandatory open question to the form ("what would you change?") to capture improvements the 1–5 scale does not show.' : 'Incluir na ficha uma pergunta aberta obrigatória ("o que mudaria?") para captar melhorias que a escala de 1 a 5 não mostra.']));
    $('ex-acoes').replaceChildren(...ac);
  }
  $('btn-copy').addEventListener('click', async () => {
    const sec = (id, h) => h + '\n' + [...$(id).querySelectorAll('li')].map((l) => '• ' + l.textContent.trim()).join('\n');
    const txt = [IDX ? rowFull(IDX, IDX.e.get(escopoAtual(IDX))) : '', $('sv-take').textContent.trim(), '', sec('ex-fortes', t('ex_fortes')), '', sec('ex-atencao', t('ex_atencao')), '', sec('ex-acoes', t('ex_acoes'))].join('\n');
    let ok = false;
    try { await navigator.clipboard.writeText(txt); ok = true; } catch (e) {
      try { const ta = el('textarea'); ta.value = txt; ta.style.position = 'absolute'; ta.style.left = '-9999px'; root.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove(); } catch (e2) { ok = false; }
    }
    toast(ok ? t('copied') : t('failed'));
  });

  // ---------- CSV ----------
  const csvString = (header, rows) => {
    const sep = Li() ? ',' : ';';
    const cell = (v) => { if (v == null) return ''; let s = typeof v === 'number' ? (Li() ? String(v) : String(v).replace('.', ',')) : String(v); if (/[";,\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"'; return s; };
    return '﻿' + [header, ...rows].map((r) => r.map(cell).join(sep)).join('\r\n');
  };
  const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60);
  const scopeSlug = () => slug(IDX ? rowFull(IDX, IDX.e.get(escopoAtual(IDX))) : 'geral');
  document.querySelectorAll('.sv-csv').forEach((b) => {
    b.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5v8m0 0L5 7.5m3 3l3-3M3 13.5h10"/></svg>';
    b.append(el('span', '', 'CSV'));
    b.addEventListener('click', () => { const d = CSVD[b.dataset.csv]; if (!d) return; deliver(new Blob([csvString(d.header, d.rows)], { type: 'text/csv' }), `${b.dataset.name}_${scopeSlug()}.csv`, b.closest('.sv-card'), false); });
  });
  $('btn-csv').addEventListener('click', () => {
    const d = dash.data('relatorios'); if (d.status !== 'ok' || !IDX) return;
    const r = IDX.e.get(escopoAtual(IDX));
    const rows = d.data.filter((x) => (r.nivel === 'geral') || (r.nivel === 'area' && x.sigla.slice(0, 4) === r.area) || (r.nivel === 'curso' && x.sigla === r.sigla) || (r.nivel === 'turma' && x.sigla === r.sigla && Number(x.turma) === r.turma));
    const keys = ['objetivos', 'teoria_pratica', 'material', 'pontualidade', 'instalacoes', 'apoio_adm', 'audiovisuais', 'dominio', 'clareza', 'duvidas', 'conhec_antes', 'conhec_apos'];
    const stx = { 'Preenchido': t('st_pre'), 'Não preenchido': t('st_nao'), 'Faltoso': t('st_fal') };
    const header = ['Sigla', t('col_curso'), t('col_area'), t('col_turma'), Li() ? 'Form' : 'Relatório', 'Status', ...keys.map(qLabel)];
    const out = rows.map((x) => [x.sigla, cname(IDX, x.sigla), x.sigla.slice(0, 4), Number(x.turma), Number(x.relatorio), stx[x.status] || x.status, ...keys.map((k) => (x[k] === '' || x[k] == null ? null : Number(x[k])))]);
    deliver(new Blob([csvString(header, out)], { type: 'text/csv' }), `fichas_${scopeSlug()}.csv`, $('cabecalho'), false);
  });

  // ---------- Export to PNG ----------
  const ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5v8m0 0L5 7.5m3 3l3-3M3 13.5h10"/></svg>';
  document.querySelectorAll('.sv-png').forEach((b) => { b.innerHTML = ICON; b.append(el('span', '', 'PNG')); b.setAttribute('aria-label', 'PNG'); b.addEventListener('click', () => exportar(b)); });
  let DL;
  const dlReady = (async () => { try { DL = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { DL = null; } })();
  const INH = ['color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-transform', 'white-space', 'visibility', 'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'text-anchor', 'dominant-baseline', 'font-variant-numeric', 'border-collapse', 'border-spacing', 'list-style-type', 'word-break', 'overflow-wrap'];
  const ALWAYS = new Set(['color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'text-align', 'letter-spacing', 'text-transform']);
  const NON = {
    display: null, position: 'static', top: 'auto', left: 'auto', right: 'auto', bottom: 'auto',
    'margin-top': '0px', 'margin-right': '0px', 'margin-bottom': '0px', 'margin-left': '0px',
    'padding-top': '0px', 'padding-right': '0px', 'padding-bottom': '0px', 'padding-left': '0px',
    'border-top-width': '0px', 'border-right-width': '0px', 'border-bottom-width': '0px', 'border-left-width': '0px',
    'border-top-style': 'none', 'border-right-style': 'none', 'border-bottom-style': 'none', 'border-left-style': 'none',
    'border-top-color': null, 'border-right-color': null, 'border-bottom-color': null, 'border-left-color': null,
    'border-top-left-radius': '0px', 'border-top-right-radius': '0px', 'border-bottom-left-radius': '0px', 'border-bottom-right-radius': '0px',
    'background-color': 'rgba(0, 0, 0, 0)', 'background-image': 'none', 'box-shadow': 'none', opacity: '1',
    'overflow-x': 'visible', 'overflow-y': 'visible', 'min-width': 'auto', 'min-height': 'auto', 'max-width': 'none', 'max-height': 'none',
    'flex-grow': '0', 'flex-shrink': '1', 'flex-basis': 'auto', 'flex-direction': 'row', 'flex-wrap': 'nowrap', 'align-items': 'normal', 'justify-content': 'normal', 'align-self': 'auto',
    'row-gap': 'normal', 'column-gap': 'normal', 'grid-template-columns': 'none', 'grid-template-rows': 'none', 'grid-column-start': 'auto', 'grid-column-end': 'auto', order: '0',
    'z-index': 'auto', 'text-overflow': 'clip', 'vertical-align': 'baseline', 'box-sizing': 'content-box', 'object-fit': 'fill', 'table-layout': 'auto', transform: 'none', 'text-decoration-line': 'none',
  };
  function inline(src, dst, parentCS) {
    const cs = getComputedStyle(src);
    let s = src.getAttribute('style') || '';
    if (s && !s.trim().endsWith(';')) s += ';';
    const html = src.namespaceURI === 'http://www.w3.org/1999/xhtml';
    for (const p of INH) { const v = cs.getPropertyValue(p); if (!parentCS || parentCS.getPropertyValue(p) !== v || (html && ALWAYS.has(p))) s += p + ':' + v + ';'; }
    for (const p in NON) { const v = cs.getPropertyValue(p); if (v !== NON[p] && v !== '') s += p + ':' + v + ';'; }
    const tag = src.tagName.toLowerCase();
    if (tag === 'svg' || tag === 'img' || tag === 'canvas') s += 'width:' + cs.width + ';height:' + cs.height + ';';
    else if (html && cs.display !== 'inline' && cs.display !== 'none') {
      s += 'width:' + cs.width + ';';
      if (!src.textContent.trim()) s += 'height:' + cs.height + ';';
    }
    if (html && (tag === 'button' || tag === 'select' || tag === 'input')) for (const q in NON) s += q + ':' + cs.getPropertyValue(q) + ';';
    s += 'animation:none;transition:none;';
    dst.setAttribute('style', s);
    return cs;
  }
  function walk(src, dst, parentCS) {
    const cs = inline(src, dst, parentCS);
    const sc = src.children, dc = dst.children;
    for (let i = 0; i < sc.length; i++) walk(sc[i], dc[i], cs);
  }
  async function renderPNG(node) {
    const W = Math.ceil(node.getBoundingClientRect().width);
    const pad = 28;
    const clone = node.cloneNode(true);
    walk(node, clone, null);
    clone.querySelectorAll('.sv-tools, .sv-png, .sv-csv, .sv-tip, .sv-preview, .sv-i, input').forEach((e) => e.remove());
    clone.querySelectorAll('.sv-scroll').forEach((e) => { e.style.maxHeight = 'none'; e.style.height = 'auto'; e.style.overflow = 'visible'; let p = e.parentElement; while (p) { p.style.height = 'auto'; p.style.maxHeight = 'none'; p = p.parentElement; } });
    clone.querySelectorAll('th').forEach((e) => { e.style.position = 'static'; });
    clone.style.width = W + 'px'; clone.style.height = 'auto'; clone.style.margin = '0';
    const rcs = getComputedStyle(node);
    const probe = el('div'); probe.style.color = 'var(--color-bg)'; root.appendChild(probe); const bg = getComputedStyle(probe).color; probe.style.color = 'var(--color-fg-muted)'; const muted = getComputedStyle(probe).color; probe.remove();
    const wrap = document.createElement('div');
    let vars = '';
    const scs = getComputedStyle(root);
    for (let i = 0; i < scs.length; i++) { const p = scs[i]; if (p.startsWith('--')) vars += p + ':' + scs.getPropertyValue(p) + ';'; }
    wrap.setAttribute('style', vars + `box-sizing:border-box;width:${W + pad * 2}px;padding:${pad}px;background:${bg};font-family:${rcs.fontFamily};color:${rcs.color};`);
    wrap.appendChild(clone);
    const foot = document.createElement('div');
    foot.textContent = `${t('title')} · ${IDX ? rowFull(IDX, IDX.e.get(escopoAtual(IDX))) : ''} · ${t('generated', { d: new Date().toLocaleDateString(LOC()) })}`;
    foot.setAttribute('style', `margin-top:14px;font-size:11px;color:${muted};font-family:${rcs.fontFamily};`);
    wrap.appendChild(foot);
    const host = document.createElement('div');
    host.setAttribute('style', 'position:absolute;left:-200000px;top:0;width:' + (W + pad * 2) + 'px;');
    root.appendChild(host); host.appendChild(wrap);
    const Ht = Math.ceil(wrap.getBoundingClientRect().height) + 14, Wt = W + pad * 2;
    host.remove();
    const scale = Math.max(1, Math.min(3, Math.sqrt(140e6 / (Wt * Ht))));
    const xml = new XMLSerializer().serializeToString(wrap);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(Wt * scale)}" height="${Math.round(Ht * scale)}" viewBox="0 0 ${Wt} ${Ht}"><foreignObject x="0" y="0" width="${Wt}" height="${Ht}">${xml}</foreignObject></svg>`;
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    const c = document.createElement('canvas'); c.width = Math.round(Wt * scale); c.height = Math.round(Ht * scale);
    const ctx = c.getContext('2d'); ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('PNG'))), 'image/png'));
  }
  function preview(blob, fname, node, isImg) {
    const host = node && node.classList.contains('sv-card') ? node : node ? node.parentElement : root;
    host.querySelectorAll(':scope .sv-preview').forEach((p) => p.remove());
    const url = URL.createObjectURL(blob);
    const box = el('div', 'sv-preview');
    const p = el('p', '', isImg ? t('prev_img') : t('prev_note'));
    const row = el('div');
    const a = el('a', '', t('dl', { f: fname })); a.href = url; a.download = fname;
    const x = el('button', 'sv-btn', t('close')); x.type = 'button'; x.addEventListener('click', () => { box.remove(); URL.revokeObjectURL(url); });
    row.append(a, x); box.append(p);
    if (isImg) { const img = el('img'); img.src = url; img.alt = fname; box.append(img); }
    box.append(row);
    if (node && node.classList.contains('sv-card')) { const head = node.querySelector('.sv-card-head'); head.after(box); } else if (node) node.before(box); else root.prepend(box);
    try { a.click(); } catch (e) { /* preview stays */ }
  }
  async function deliver(blob, fname, node, isImg) {
    if (DL === undefined) await Promise.race([dlReady, new Promise((r) => setTimeout(r, 1500))]);
    if (DL) { try { await DL.save({ filename: fname, data: blob }); return; } catch (e) { if (e && (e.code === 'declined' || e.code === 'rate_limited')) return; } }
    if (STANDALONE) { const u = URL.createObjectURL(blob); const lk = document.createElement('a'); lk.href = u; lk.download = fname; document.body.appendChild(lk); lk.click(); lk.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); return; }
    preview(blob, fname, node, isImg);
  }
  async function exportar(btn) {
    const node = document.getElementById(btn.dataset.export); if (!node) return;
    const lbl = btn.querySelector('span');
    lbl.textContent = t('gen'); btn.disabled = true;
    try {
      const blob = await renderPNG(node);
      await deliver(blob, `${btn.dataset.name}_${scopeSlug()}.png`, node, true);
      lbl.textContent = 'PNG';
    } catch (e) {
      lbl.textContent = t('failed'); setTimeout(() => { lbl.textContent = 'PNG'; }, 2500);
    } finally { btn.disabled = false; }
  }

  // ---------- main ----------
  applyColors();
  applyI18n();
  buildCfgPanel();
  let lastLang = null;
  dash.onData(() => {
    applyColors();
    if (lastLang !== UI.lang) { applyI18n(); lastLang = UI.lang; }
    const dE = dash.data('escopos'), dI = dash.data('itens'), dK = dash.data('conhecimento'), dQ = dash.data('qualidade'), dC = dash.data('cursos');
    const ok = (d) => d.status === 'ok' && Array.isArray(d.data) && d.data.length;
    const bad = (d) => ['error', 'connect', 'declined', 'missing'].includes(d.status);
    if (ok(dQ)) drawQualidade(dQ.data); else if (bad(dQ)) fail($('qual-cards'));
    if (!(ok(dE) && ok(dI) && ok(dK) && ok(dC))) {
      if ([dE, dI, dK, dC].some(bad)) ['chart-itens', 'dims', 'chart-matriz-conh', 'chart-prioridade', 'chart-funil', 'chart-turmas', 'heat-wrap', 'rank-wrap', 'part-list'].forEach((id) => fail($(id)));
      return;
    }
    const X = indexes(dE.data, dI.data, dK.data, dC.data);
    const esc = escopoAtual(X);
    const nAreas = new Set(X.cursos.map((c) => c.area)).size, nTurmas = [...X.e.values()].filter((r) => r.nivel === 'turma').length;
    $('sv-eyebrow-n').textContent = t('counts', { c: X.cursos.length, a: nAreas, t: fi(nTurmas) });
    drawFilters(X, esc);
    drawKpis(X, esc);
    drawTake(X, esc);
    drawItens(X, esc);
    drawDims(X, esc);
    drawConh(X, esc);
    drawPrioridade(X, esc);
    drawFunil(X, esc);
    drawTurmas(X, esc);
    drawHeat(X, esc);
    drawRanking(X, esc);
    drawParticipacao(X, esc);
    drawExec(X, esc);
    paintPreview();
    firstDraw = false;
  });
})();
