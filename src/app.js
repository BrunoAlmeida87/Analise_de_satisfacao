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
    view: 'painel',
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
  let firstDraw = true;

  // ---------- DOM helpers ----------
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const B = (text, cls) => el('b', cls, text);
  const para = (node, parts) => node.replaceChildren(...parts.flat(3).filter((p) => p != null && p !== '').map((p) => (typeof p === 'string' ? document.createTextNode(p) : p)));
  const empty = (node, msg) => { node.querySelectorAll(':scope > svg').forEach((s) => s.remove()); let e = node.querySelector(':scope > .sv-empty'); if (!e) { e = el('div', 'sv-empty'); node.prepend(e); } e.textContent = msg; };
  const clearChart = (node) => { node.querySelectorAll(':scope > svg, :scope > .sv-empty').forEach((s) => s.remove()); };
  const tipFor = (box) => { let tp = box.querySelector(':scope > .sv-tip'); if (!tp) { tp = el('div', 'sv-tip'); box.appendChild(tp); } return tp; };
  const showTip = (box, tip, ev, head, lines) => {
    tip.replaceChildren(el('div', 'sv-tip-h', head));
    lines.forEach((l) => { const d = el('div'); if (Array.isArray(l)) { const sw = el('i'); sw.style.background = l[0]; d.append(sw, l[1]); } else d.textContent = l; tip.appendChild(d); });
    const r = box.getBoundingClientRect();
    tip.style.opacity = 1;
    let x = ev.clientX - r.left + 14; const y = ev.clientY - r.top + 14;
    if (x + tip.offsetWidth > r.width) x = Math.max(0, ev.clientX - r.left - tip.offsetWidth - 14);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  };
  const hideTip = (tip) => { tip.style.opacity = 0; tip.style.left = '0px'; tip.style.top = '0px'; };
  const styleAxis = (a) => { a.attr('font-size', null).attr('font-family', null); a.selectAll('text').style('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)'); a.selectAll('line,path').style('stroke', 'var(--cds-chart-axis)'); };
  const textW = (svg, txt, size) => { const tt = svg.append('text').style('font-size', size).text(txt); const w = tt.node().getComputedTextLength(); tt.remove(); return w; };
  const infoBtn = (key) => { const b = el('button', 'sv-i', 'i'); b.type = 'button'; b.dataset.tip = key; return b; };
  const toast = (msg) => { const tt = $('sv-toast'); tt.textContent = msg; tt.style.opacity = 1; clearTimeout(toast.h); toast.h = setTimeout(() => { tt.style.opacity = 0; }, 2200); };

  // ---------- colors ----------
  const NV = ['var(--sv-n1)', 'var(--sv-n2)', 'var(--sv-n3)', 'var(--sv-n4)', 'var(--sv-n5)'];
  const HB = ['var(--sv-h1)', 'var(--sv-h2)', 'var(--sv-h3)', 'var(--sv-h4)'];
  const SERIES = ['var(--sv-accent)', '#3d6fb4', '#c07a2c', '#8a5cc2', '#c0507f', '#2f8f9d'];
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

  // ---------- data model ----------
  const QK = ['objetivos', 'teoria_pratica', 'material', 'pontualidade', 'instalacoes', 'apoio_adm', 'audiovisuais', 'dominio', 'clareza', 'duvidas'];
  const QDIM = ['programa', 'programa', 'programa', 'organizacao', 'organizacao', 'organizacao', 'organizacao', 'instrutor', 'instrutor', 'instrutor'];
  const DIMK = { programa: [0, 1, 2], organizacao: [3, 4, 5, 6], instrutor: [7, 8, 9] };
  const num = (x) => (x === '' || x == null ? null : Number(x));
  let DB = null;
  function buildDB(rel, cur) {
    if (DB && DB.src[0] === rel && DB.src[1] === cur) return DB;
    const rows = rel.map((r, i) => {
      const v = QK.map((k) => num(r[k]));
      const ok = v.filter((x) => x != null);
      const ka = num(r.conhec_antes), kd = num(r.conhec_apos);
      const tot = ok.reduce((p, x) => p + x, 0);
      return {
        i, sigla: r.sigla, area: r.sigla.slice(0, 4), turma: Number(r.turma), rel: Number(r.relatorio), status: r.status, pre: r.status === 'Preenchido',
        v, ka, kd, cnt: ok.length, tot, idx: ok.length ? tot / ok.length : null, nAns: ok.length + (ka != null) + (kd != null), all5: ok.length > 0 && ok.every((x) => x === 5), tk: r.sigla + '|' + Number(r.turma),
      };
    });
    const cursos = new Map(cur.map((c) => [c.sigla, c]));
    const preByCourse = d3.rollup(rows, (v) => v.filter((r) => r.pre).length, (r) => r.sigla);
    const preByTurma = d3.rollup(rows, (v) => v.filter((r) => r.pre).length, (r) => r.tk);
    DB = { src: [rel, cur], rows, cursos, preByCourse, preByTurma };
    DB.G = agg(rows);
    DB.courseGroups = groups(rows, 'curso', false);
    return DB;
  }
  function agg(rows) {
    const a = { fichas: rows.length, preenchidas: 0, nao_preenchidas: 0, faltosos: 0, faltosos_com_respostas: 0, fichas_parciais: 0 };
    const dist = [0, 0, 0, 0, 0];
    const it = QK.map(() => ({ c: [0, 0, 0, 0, 0], n: 0, sx: 0, sxx: 0, cn: 0, cx: 0, cy: 0, cxx: 0, cyy: 0, cxy: 0 }));
    let ni = 0, si = 0, si2 = 0, mx = 0, nk = 0, ska = 0, skd = 0, ev = 0, ig = 0, rg = 0;
    const cells = new Map();
    for (const r of rows) {
      if (r.status === 'Faltoso') { a.faltosos++; if (r.nAns) a.faltosos_com_respostas++; continue; }
      if (!r.pre) { a.nao_preenchidas++; continue; }
      a.preenchidas++;
      if (r.nAns > 0 && r.nAns < 12) a.fichas_parciais++;
      for (let i = 0; i < 10; i++) {
        const x = r.v[i]; if (x == null) continue;
        dist[x - 1]++;
        const q = it[i]; q.c[x - 1]++; q.n++; q.sx += x; q.sxx += x * x;
        if (r.cnt > 1) { const y = (r.tot - x) / (r.cnt - 1); q.cn++; q.cx += x; q.cy += y; q.cxx += x * x; q.cyy += y * y; q.cxy += x * y; }
      }
      if (r.idx != null) { ni++; si += r.idx; si2 += r.idx * r.idx; if (r.all5) mx++; }
      if (r.ka != null && r.kd != null) { nk++; ska += r.ka; skd += r.kd; if (r.kd > r.ka) ev++; else if (r.kd === r.ka) ig++; else rg++; const k = r.ka + '|' + r.kd; cells.set(k, (cells.get(k) || 0) + 1); }
    }
    const pc = (x, y) => (y ? (x / y) * 100 : null);
    const nr = dist.reduce((p, x) => p + x, 0);
    Object.assign(a, {
      taxa_resposta: pc(a.preenchidas, a.preenchidas + a.nao_preenchidas), taxa_ausencia: pc(a.faltosos, a.fichas),
      respostas_itens: nr, indice: ni ? si / ni : null, dp_indice: ni > 1 ? Math.sqrt(Math.max(0, (si2 - (si * si) / ni) / (ni - 1))) : null, n_indice: ni,
      pct_otimo: pc(dist[4], nr), pct_muito_bom: pc(dist[3], nr), pct_bom: pc(dist[2], nr), pct_regular: pc(dist[1], nr), pct_fraco: pc(dist[0], nr),
      pct_ate_bom: pc(dist[0] + dist[1] + dist[2], nr), pct_nota_maxima: pc(mx, ni),
      conhec_antes: nk ? ska / nk : null, conhec_apos: nk ? skd / nk : null, ganho: nk ? (skd - ska) / nk : null,
      pct_evoluiu: pc(ev, nk), pct_igual: pc(ig, nk), pct_regrediu: pc(rg, nk), n_conhecimento: nk,
    });
    a.items = it.map((q, i) => {
      const den = Math.sqrt((q.cn * q.cxx - q.cx * q.cx) * (q.cn * q.cyy - q.cy * q.cy));
      return {
        chave: QK[i], ordem: i + 1, dimensao: QDIM[i], n: q.n, media: q.n ? q.sx / q.n : null,
        dp: q.n > 1 ? Math.sqrt(Math.max(0, (q.sxx - (q.sx * q.sx) / q.n) / (q.n - 1))) : null,
        pct1: pc(q.c[0], q.n), pct2: pc(q.c[1], q.n), pct3: pc(q.c[2], q.n), pct4: pc(q.c[3], q.n), pct5: pc(q.c[4], q.n),
        pct_ate_bom: pc(q.c[0] + q.c[1] + q.c[2], q.n), correlacao: q.cn >= 10 && den > 0 ? (q.cn * q.cxy - q.cx * q.cy) / den : null,
      };
    });
    Object.keys(DIMK).forEach((d) => { let n = 0, s = 0, o = 0; DIMK[d].forEach((i) => { n += it[i].n; s += it[i].sx; o += it[i].c[4]; }); a['media_' + d] = n ? s / n : null; a['otimo_' + d] = pc(o, n); });
    let fr = null; a.items.forEach((q) => { if (!q.n) return; if (!fr || q.pct5 < fr.pct5 || (q.pct5 === fr.pct5 && q.media < fr.media)) fr = q; });
    a.item_mais_fraco = fr ? fr.chave : null; a.otimo_item_mais_fraco = fr ? fr.pct5 : null;
    a.cells = [...cells].map(([k, n]) => { const [x, y] = k.split('|').map(Number); return { antes: x, apos: y, fichas: n, pct: (n / nk) * 100 }; });
    return a;
  }
  function groups(rows, lvl, onlyFilled) {
    const keyOf = lvl === 'area' ? (r) => r.area : lvl === 'curso' ? (r) => r.sigla : (r) => r.tk;
    const m = d3.group(rows, keyOf);
    const out = [...m].map(([key, rs]) => ({ key, nivel: lvl, area: rs[0].area, sigla: lvl === 'area' ? '' : rs[0].sigla, turma: lvl === 'turma' ? rs[0].turma : null, rows: rs, ...agg(rs) }));
    return onlyFilled ? out.filter((g) => g.preenchidas > 0) : out;
  }

  // ---------- names ----------
  const cname = (sigla) => { const c = DB && DB.cursos.get(sigla); if (!c) return sigla; return UI.clang === 'en' ? (c.curso_en || c.curso) : c.curso; };
  const gName = (g) => (g.nivel === 'area' ? t('area_x', { a: g.area }) : g.nivel === 'curso' ? cname(g.sigla) : t('turma_x', { t: g.turma }));
  const gFull = (g) => (g.nivel === 'curso' ? g.sigla + ' · ' + cname(g.sigla) : g.nivel === 'turma' ? g.sigla + ' · ' + t('turma_x', { t: g.turma }) : gName(g));

  // ---------- filter state ----------
  const arr = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : String(v).split(',').filter(Boolean));
  const F = () => { const p = P(); return { areas: arr(p.areas), cursos: arr(p.cursos), turmas: arr(p.turmas), onlyFilled: p.onlyFilled === true || p.onlyFilled === 'true', grp: p.grp || 'auto' }; };
  const hist = [];
  function setFilter(patch, noHist) {
    const cur = F();
    if (!noHist) { hist.push(cur); if (hist.length > 50) hist.shift(); }
    const nx = { ...cur, ...patch };
    if (nx.areas.length) { const A = new Set(nx.areas); nx.cursos = nx.cursos.filter((s) => A.has(s.slice(0, 4))); nx.turmas = nx.turmas.filter((k) => A.has(k.slice(0, 4))); }
    if (nx.cursos.length) { const C = new Set(nx.cursos); nx.turmas = nx.turmas.filter((k) => C.has(k.split('|')[0])); }
    dash.setParams({ areas: nx.areas, cursos: nx.cursos, turmas: nx.turmas, onlyFilled: nx.onlyFilled, grp: nx.grp });
  }
  function scopeRows() {
    const f = F();
    const A = new Set(f.areas), C = new Set(f.cursos), T = new Set(f.turmas);
    return DB.rows.filter((r) => (!A.size || A.has(r.area)) && (!C.size || C.has(r.sigla)) && (!T.size || T.has(r.tk))
      && (!f.onlyFilled || (DB.preByCourse.get(r.sigla) > 0 && DB.preByTurma.get(r.tk) > 0)));
  }
  const isFiltered = () => { const f = F(); return !!(f.areas.length || f.cursos.length || f.turmas.length || f.onlyFilled); };
  function level() {
    const f = F();
    if (f.grp !== 'auto') return f.grp;
    if (f.turmas.length || f.cursos.length === 1) return 'turma';
    return 'curso';
  }
  function scopeLabel() {
    const f = F();
    if (f.turmas.length === 1) { const [s, tt] = f.turmas[0].split('|'); return s + ' · ' + t('turma_x', { t: tt }); }
    if (f.turmas.length > 1) return t('scope_turmas', { n: f.turmas.length });
    if (f.cursos.length === 1) return f.cursos[0] + ' · ' + cname(f.cursos[0]);
    if (f.cursos.length > 1) return t('scope_cursos', { n: f.cursos.length }) + ': ' + f.cursos.slice(0, 3).join(', ') + (f.cursos.length > 3 ? '…' : '');
    if (f.areas.length) return t('scope_areas', { v: f.areas.join(', ') });
    return t('scope_all');
  }
  const minN = () => Number(P().minN ?? 5);

  // ---------- static text ----------
  function applyI18n() {
    document.querySelectorAll('.sv [data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
    document.querySelectorAll('.sv [data-i18n-m]').forEach((n) => { const m = I.M[n.dataset.i18nM][Li()]; n.textContent = m[0] + ': ' + m[1]; n.style.fontWeight = '400'; });
    $('rank-search').placeholder = t('search'); $('d-search').placeholder = t('search');
    document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(UI.lang === b.dataset.lang)));
    const fc = $('f-clang'); fc.options[0].textContent = t('clang_pt'); fc.options[1].textContent = t('clang_en'); fc.value = UI.clang;
    const fm = $('f-min'); fm.replaceChildren(...[1, 5, 10, 30].map((n) => new Option(n === 1 ? t('min_all') : t('min_n', { n }), String(n)))); fm.value = String(P().minN ?? 5);
    const fg = $('f-grp'); fg.replaceChildren(...['auto', 'area', 'curso', 'turma'].map((g) => new Option(t('grp_' + g), g))); fg.value = F().grp;
    $('dl-metricas').replaceChildren(...Object.keys(I.M).flatMap((k) => { const [tt, d] = I.M[k][Li()]; return [el('dt', '', tt), el('dd', '', d)]; }));
    const groupsQ = [['programa', ['objetivos', 'teoria_pratica', 'material']], ['organizacao', ['pontualidade', 'instalacoes', 'apoio_adm', 'audiovisuais']], ['instrutor', ['dominio', 'clareza', 'duvidas']], [null, ['conhec_antes', 'conhec_apos']]];
    $('dl-perguntas').replaceChildren(...groupsQ.flatMap(([g, ks]) => ks.flatMap((k) => { const dt = el('dt', '', qLabel(k)); dt.append(el('small', '', g ? dimName(g) : t('nav_aprend'))); return [dt, el('dd', '', I.Q[k].d[Li()])]; })));
    $('lim-list').replaceChildren(...I.LIM.map((l) => el('li', '', l[Li()])));
    document.querySelectorAll('.sv-exp').forEach(buildExp);
    updateBaseLabel();
  }
  function updateBaseLabel() {
    const b = window.SV_BASE_INFO ? window.SV_BASE_INFO() : null;
    $('sv-base-label').textContent = STANDALONE ? '· ' + (b && b.kind === 'user' ? t('base_user', { f: b.file, d: new Date(b.at).toLocaleDateString(LOC()) }) : t('base_orig')) : '';
  }

  // ---------- popover for ⓘ ----------
  const pop = $('sv-pop');
  const tipText = (key) => { if (key.startsWith('q:')) { const q = I.Q[key.slice(2)]; return [q.l[Li()], q.d[Li()]]; } const m = I.M[key]; return m ? m[Li()] : [key, '']; };
  const showPop = (btn) => {
    const [h, d] = tipText(btn.dataset.tip);
    pop.replaceChildren(el('b', '', h), document.createTextNode(d));
    const rr = root.getBoundingClientRect(), br = btn.getBoundingClientRect();
    pop.style.opacity = 1;
    let x = br.left - rr.left - 10; const y = br.bottom - rr.top + 8;
    if (x + pop.offsetWidth > rr.width) x = Math.max(0, rr.width - pop.offsetWidth);
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
  };
  const hidePop = () => { pop.style.opacity = 0; };
  root.addEventListener('mouseover', (e) => { const b = e.target.closest('.sv-i'); if (b) showPop(b); });
  root.addEventListener('mouseout', (e) => { if (e.target.closest('.sv-i')) hidePop(); });
  root.addEventListener('focusin', (e) => { const b = e.target.closest('.sv-i'); if (b) showPop(b); });
  root.addEventListener('focusout', (e) => { if (e.target.closest('.sv-i')) hidePop(); });
  root.addEventListener('click', (e) => { const b = e.target.closest('.sv-i'); if (b) { e.stopPropagation(); e.preventDefault(); showPop(b); } }, true);

  // ---------- multi-select ----------
  const openPops = new Set();
  const coarse = () => { try { return window.matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } };
  document.addEventListener('click', (e) => {
    openPops.forEach((ms) => { if (!ms.host.contains(e.target)) ms.close(); });
    document.querySelectorAll('.sv-exp-menu').forEach((m) => { if (!m.parentElement.contains(e.target)) m.hidden = true; });
  });
  function MultiSelect(host, key, masc, getOptions) {
    const btn = el('button', 'sv-ms-btn'); btn.type = 'button';
    const popEl = el('div', 'sv-ms-pop'); popEl.hidden = true;
    const search = el('input'); search.type = 'search';
    const acts = el('div', 'sv-ms-acts');
    const bAll = el('button'); bAll.type = 'button'; const bClr = el('button'); bClr.type = 'button'; const bInv = el('button'); bInv.type = 'button';
    acts.append(bAll, bClr, bInv);
    const list = el('div', 'sv-ms-list');
    popEl.append(search, acts, list); host.append(btn, popEl);
    const ms = { host, open: false, close: () => { ms.open = false; popEl.hidden = true; openPops.delete(ms); } };
    let opts = [];
    const sel = () => new Set(F()[key]);
    const visible = () => { const q = search.value.trim().toLowerCase(); return opts.filter((o) => !q || (o.label + ' ' + o.value + ' ' + (o.group || '')).toLowerCase().includes(q)); };
    const commit = (set) => setFilter({ [key]: opts.map((o) => o.value).filter((v) => set.has(v)) });
    const renderList = () => {
      const s = sel(); const vis = visible(); let lastG = null;
      const nodes = [];
      if (!vis.length) nodes.push(el('div', 'sv-empty', t('ms_none')));
      vis.forEach((o) => {
        if (o.group && o.group !== lastG) { lastG = o.group; nodes.push(el('div', 'sv-ms-grp', o.group)); }
        const lb = el('label', o.count === 0 ? 'sv-dim' : '');
        const cb = el('input'); cb.type = 'checkbox'; cb.checked = s.has(o.value);
        cb.addEventListener('change', () => { const ns = sel(); if (cb.checked) ns.add(o.value); else ns.delete(o.value); commit(ns); });
        lb.append(cb, el('span', '', o.label), el('small', '', fi(o.count)));
        nodes.push(lb);
      });
      const sc = list.scrollTop; list.replaceChildren(...nodes); list.scrollTop = sc;
    };
    btn.addEventListener('click', () => { if (ms.open) { ms.close(); return; } openPops.forEach((o) => o.close()); ms.open = true; popEl.hidden = false; openPops.add(ms); renderList(); placePop(); if (!coarse()) search.focus(); });
    const placePop = () => {
      popEl.style.left = '0px';
      const r = popEl.getBoundingClientRect(), pad = 8;
      if (r.right > window.innerWidth - pad) popEl.style.left = Math.max(pad - host.getBoundingClientRect().left, window.innerWidth - pad - r.right) + 'px';
    };
    search.addEventListener('input', renderList);
    bAll.addEventListener('click', () => { const s = sel(); visible().forEach((o) => s.add(o.value)); commit(s); });
    bClr.addEventListener('click', () => { if (search.value.trim()) { const s = sel(); visible().forEach((o) => s.delete(o.value)); commit(s); } else commit(new Set()); });
    bInv.addEventListener('click', () => { const s = sel(); visible().forEach((o) => { if (s.has(o.value)) s.delete(o.value); else s.add(o.value); }); commit(s); });
    ms.update = () => {
      opts = getOptions();
      const s = F()[key];
      btn.textContent = !s.length ? t(masc ? 'ms_all_m' : 'ms_all') : s.length === 1 ? (opts.find((o) => o.value === s[0])?.label || s[0]) : t(masc ? 'ms_n_m' : 'ms_n', { n: s.length });
      btn.title = btn.textContent;
      btn.classList.toggle('sv-on', s.length > 0);
      search.placeholder = t('ms_search'); bAll.textContent = t('ms_sel_all'); bClr.textContent = t('ms_clear'); bInv.textContent = t('ms_invert');
      if (ms.open) renderList();
    };
    return ms;
  }
  const msArea = MultiSelect($('ms-area'), 'areas', false, () => {
    const f = F();
    const by = d3.group(DB.rows, (r) => r.area);
    return [...by].sort((a, b) => d3.ascending(a[0], b[0])).map(([a, rs]) => { const nc = new Set(rs.map((r) => r.sigla)).size; return { value: a, label: `${a} · ${t(nc > 1 ? 'n_courses_pl' : 'n_courses', { n: nc })}`, count: rs.filter((r) => r.pre).length }; }).filter((o) => !f.onlyFilled || o.count > 0);
  });
  const msCurso = MultiSelect($('ms-curso'), 'cursos', true, () => {
    const f = F(); const A = new Set(f.areas);
    const cs = [...DB.cursos.values()].filter((c) => !A.size || A.has(c.area)).sort((a, b) => d3.ascending(a.sigla, b.sigla));
    return cs.map((c) => ({ value: c.sigla, label: `${c.sigla} · ${cname(c.sigla)}`, count: DB.preByCourse.get(c.sigla) || 0, group: c.area })).filter((o) => !f.onlyFilled || o.count > 0);
  });
  const msTurma = MultiSelect($('ms-turma'), 'turmas', false, () => {
    const f = F(); const A = new Set(f.areas), C = new Set(f.cursos);
    const keys = [...DB.preByTurma.keys()].filter((k) => { const s = k.split('|')[0]; return (!A.size || A.has(s.slice(0, 4))) && (!C.size || C.has(s)); });
    keys.sort((a, b) => { const [sa, ta] = a.split('|'), [sb, tb] = b.split('|'); return d3.ascending(sa, sb) || Number(ta) - Number(tb); });
    return keys.map((k) => { const [s, tt] = k.split('|'); return { value: k, label: `${s} · ${t('turma_x', { t: tt })}`, count: DB.preByTurma.get(k) || 0, group: s + ' · ' + cname(s) }; }).filter((o) => !f.onlyFilled || o.count > 0);
  });

  // ---------- controls ----------
  $('f-min').addEventListener('change', (e) => dash.setParams({ minN: Number(e.target.value) }));
  $('f-grp').addEventListener('change', (e) => setFilter({ grp: e.target.value }));
  $('f-only').addEventListener('change', (e) => setFilter({ onlyFilled: e.target.checked }));
  $('f-clang').addEventListener('change', (e) => { UI.clang = e.target.value; store.set('sv-clang', UI.clang); redraw(); });
  $('f-reset').addEventListener('click', () => setFilter({ areas: [], cursos: [], turmas: [], onlyFilled: false, grp: 'auto' }));
  $('f-back').addEventListener('click', () => { const prev = hist.pop(); if (prev) setFilter(prev, true); });
  document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => { UI.lang = b.dataset.lang; store.set('sv-lang', UI.lang); applyI18n(); buildCfgPanel(); redraw(); }));
  document.querySelectorAll('[data-ordem]').forEach((b) => b.addEventListener('click', () => dash.setParams({ ordem: b.dataset.ordem })));
  document.querySelectorAll('[data-metrica]').forEach((b) => b.addEventListener('click', () => dash.setParams({ metrica: b.dataset.metrica })));
  document.querySelectorAll('[data-rmetric]').forEach((b) => b.addEventListener('click', () => dash.setParams({ rmetric: b.dataset.rmetric })));
  document.querySelectorAll('[data-rscale]').forEach((b) => b.addEventListener('click', () => {
    const patch = { rscale: b.dataset.rscale };
    if (b.dataset.rscale === 'custom' && P().rscale !== 'custom' && SCOPE) {
      const m = (P().rmetric || 'media') === 'media';
      const cur = radarScale(m ? 'media' : 'otimo', SCOPE.S.items.map((it) => (m ? it.media : it.pct5)).filter((v) => v != null).concat(DB.G.items.map((it) => (m ? it.media : it.pct5)).filter((v) => v != null)), 'auto');
      Object.assign(patch, m ? { rmin: cur.lo, rmax: cur.hi } : { pmin: cur.lo, pmax: cur.hi });
    }
    dash.setParams(patch);
  }));
  ['r-min', 'r-max'].forEach((id) => $(id).addEventListener('change', () => {
    const m = (P().rmetric || 'media') === 'media'; const v = Number($(id).value); if (!Number.isFinite(v)) return;
    dash.setParams({ [(m ? 'r' : 'p') + (id === 'r-min' ? 'min' : 'max')]: v });
  }));
  const togglePanel = (btn, panel) => { const open = panel.hidden; panel.hidden = !open; btn.setAttribute('aria-expanded', String(open)); };
  $('btn-colors').addEventListener('click', () => togglePanel($('btn-colors'), $('colors-panel')));
  $('cfg-close').addEventListener('click', () => togglePanel($('btn-colors'), $('colors-panel')));
  $('btn-print').addEventListener('click', () => { setView('painel'); setTimeout(() => { try { window.print(); } catch (e) { /* unavailable */ } }, 50); });
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
      try { const r = await window.SV_UPLOAD.load(f); msg.textContent = t('up_ok', { f: f.name, n: fi(r.n) }); msg.classList.add('sv-good'); hist.length = 0; D = null; drawDados(); updateBaseLabel(); }
      catch (err) { msg.textContent = t('up_err', { e: err.message || String(err) }); msg.classList.add('sv-bad'); }
      e.target.value = '';
    });
    $('up-restore').addEventListener('click', () => { window.SV_UPLOAD.restore(); hist.length = 0; D = null; drawDados(); $('up-msg').textContent = ''; updateBaseLabel(); });
  }
  // views
  let painelScroll = 0;
  function setView(v) {
    UI.view = v;
    document.querySelectorAll('.sv-tip').forEach(hideTip);
    $('view-painel').hidden = v !== 'painel'; $('view-dados').hidden = v !== 'dados';
    $('sv-nav').hidden = v !== 'painel';
    document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === v)));
  }
  document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.view === UI.view) return;
    if (b.dataset.view === 'dados') { painelScroll = window.scrollY; setView('dados'); drawDados(); requestAnimationFrame(() => { const st = $('barra').getBoundingClientRect().height; const top = $('view-dados').getBoundingClientRect().top + window.scrollY - st - 8; if (window.scrollY > top) window.scrollTo(0, Math.max(0, top)); }); }
    else { setView('painel'); requestAnimationFrame(() => window.scrollTo(0, painelScroll)); }
  }));
  $('d-back').addEventListener('click', () => { setView('painel'); requestAnimationFrame(() => window.scrollTo(0, painelScroll)); });
  // section nav
  const navLinks = [...document.querySelectorAll('#sv-nav a')];
  navLinks.forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); const id = a.getAttribute('href').slice(1); const s = $(id); if (s) { s.scrollIntoView({ behavior: 'smooth', block: 'start' }); try { dash.setLink(id); } catch (err) { /* ignore */ } } }));
  try {
    const io = new IntersectionObserver((ents) => { ents.forEach((en) => { if (en.isIntersecting) { navLinks.forEach((a) => a.classList.toggle('sv-on', a.getAttribute('href') === '#' + en.target.id)); const on = navLinks.find((a) => a.classList.contains('sv-on')); const nv = $('sv-nav'); if (on && nv.scrollWidth > nv.clientWidth) { const l = on.offsetLeft - nv.offsetLeft; if (l < nv.scrollLeft || l + on.offsetWidth > nv.scrollLeft + nv.clientWidth) nv.scrollTo({ left: Math.max(0, l - 16), behavior: 'smooth' }); } } }); }, { root: document, rootMargin: '-35% 0px -60% 0px' });
    navLinks.forEach((a) => { const s = $(a.getAttribute('href').slice(1)); if (s) io.observe(s); });
  } catch (e) { /* no observer */ }

  // filtros recolhíveis em telas pequenas
  const fTog = $('f-toggle');
  const setFOpen = (o) => { $('barra').classList.toggle('sv-fopen', o); fTog.setAttribute('aria-expanded', String(o)); };
  fTog.addEventListener('click', () => setFOpen(!$('barra').classList.contains('sv-fopen')));
  document.querySelectorAll('#sv-nav a, [data-view]').forEach((a) => a.addEventListener('click', () => setFOpen(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('barra').classList.contains('sv-fopen') && !document.querySelector('.sv-ms-pop:not([hidden])')) setFOpen(false); });
  function drawFilters() {
    { const f = F(); const n = (f.areas.length ? 1 : 0) + (f.cursos.length ? 1 : 0) + (f.turmas.length ? 1 : 0) + (f.onlyFilled ? 1 : 0); $('f-count').hidden = !n; $('f-count').textContent = String(n); }
    const f = F();
    msArea.update(); msCurso.update(); msTurma.update();
    $('f-only').checked = f.onlyFilled; $('f-grp').value = f.grp; $('f-min').value = String(P().minN ?? 5);
    $('f-back').disabled = !hist.length; $('f-back').title = t('btn_back').replace(/^\S+\s/, '');
    document.querySelectorAll('[data-ordem]').forEach((b) => b.setAttribute('aria-pressed', String((P().ordem || 'form') === b.dataset.ordem)));
    document.querySelectorAll('[data-metrica]').forEach((b) => b.setAttribute('aria-pressed', String((P().metrica || 'media') === b.dataset.metrica)));
    document.querySelectorAll('[data-rmetric]').forEach((b) => b.setAttribute('aria-pressed', String((P().rmetric || 'media') === b.dataset.rmetric)));
    const rs = P().rscale || 'full', rm = (P().rmetric || 'media') === 'media';
    document.querySelectorAll('[data-rscale]').forEach((b) => b.setAttribute('aria-pressed', String(rs === b.dataset.rscale)));
    $('r-custom').hidden = rs !== 'custom';
    if (rs === 'custom' && SCOPE) {
      const sc = radarScale(rm ? 'media' : 'otimo', [1]);
      [['r-min', sc.lo], ['r-max', sc.hi]].forEach(([id, v]) => { const i = $(id); i.min = rm ? 1 : 0; i.max = rm ? 5 : 100; i.step = rm ? 0.1 : 5; if (document.activeElement !== i) i.value = rm ? String(Math.round(v * 100) / 100) : String(Math.round(v)); });
    }
  }

  // ---------- drill-down to source forms ----------
  let D = null;
  let DA = null; // vista padrão: todas as fichas do recorte
  let SCOPE = null;
  const CD = () => D || DA;
  const CSVD = {};
  function openData(spec) {
    if (UI.view === 'painel') painelScroll = window.scrollY;
    D = { sortKey: spec.hl && spec.hl.length === 1 && QK.includes(spec.hl[0]) ? spec.hl[0] : 'sigla', sortDir: 'asc', course: null, limit: 300, ...spec };
    $('d-search').value = '';
    setView('dados'); drawDados();
    requestAnimationFrame(() => {
      const st = $('barra').getBoundingClientRect().height;
      window.scrollTo(0, Math.max(0, $('view-dados').getBoundingClientRect().top + window.scrollY - st - 8));
      const th = $('d-head').querySelector('th.sv-hl'); const wrap = $('d-wrap');
      if (th) wrap.scrollLeft = Math.max(0, th.offsetLeft - wrap.clientWidth / 3); else wrap.scrollLeft = 0;
    });
  }
  const drillGroup = (g, extra) => {
    const ex = extra || {};
    const flt = g.nivel === 'curso' ? { cursos: [g.sigla], turmas: [] } : g.nivel === 'turma' ? { cursos: [g.sigla], turmas: [g.key] } : g.nivel === 'area' ? { areas: [g.area], cursos: [], turmas: [] } : null;
    openData({ label: ex.label || (() => gFull(g)), rows: ex.rows || g.rows, hl: ex.hl || [], filter: flt, filterName: () => gFull(g) });
  };
  $('d-search').addEventListener('input', () => { const d = CD(); if (d) { d.limit = 300; drawDados(); } });
  $('d-all').addEventListener('click', () => { D = null; $('d-search').value = ''; if (DA) { DA.limit = 300; DA.course = null; } drawDados(); });
  function syncDA() {
    if (!SCOPE) return;
    if (DA && DA.rows === SCOPE.rows) return;
    DA = { label: () => t('d_all'), rows: SCOPE.rows, hl: [], all: true, sortKey: DA ? DA.sortKey : 'sigla', sortDir: DA ? DA.sortDir : 'asc', course: null, limit: 300 };
  }
  $('d-filter').addEventListener('click', () => { if (D && D.filter) { setFilter(D.filter); setView('painel'); window.scrollTo(0, 0); } });
  const STX = () => ({ 'Preenchido': t('st_pre'), 'Não preenchido': t('st_nao'), 'Faltoso': t('st_fal') });
  function dadosRows() {
    const D = CD();
    if (!D) return [];
    const q = $('d-search').value.trim().toLowerCase();
    let rows = D.rows;
    if (D.course) rows = rows.filter((r) => r.sigla === D.course);
    if (q) rows = rows.filter((r) => (r.sigla + ' ' + cname(r.sigla) + ' ' + r.turma + ' ' + r.status).toLowerCase().includes(q));
    const k = D.sortKey, dir = D.sortDir === 'asc' ? 1 : -1;
    const val = (r) => (QK.includes(k) ? r.v[QK.indexOf(k)] : k === 'idx' ? r.idx : k === 'ka' ? r.ka : k === 'kd' ? r.kd : k === 'turma' ? r.turma : k === 'rel' ? r.rel : k === 'curso' ? cname(r.sigla) : k === 'status' ? r.status : r.sigla);
    return rows.slice().sort((a, b) => { const va = val(a), vb = val(b); if (va == null && vb == null) return 0; if (va == null) return 1; if (vb == null) return -1; const o = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), LOC(), { numeric: true }); return (o * dir) || a.sigla.localeCompare(b.sigla) || a.turma - b.turma || a.rel - b.rel; });
  }
  function drawDados() {
    syncDA();
    const D = CD();
    const has = !!(D && D.rows.length);
    $('d-all').hidden = !(D && !D.all);
    $('dados-n').hidden = !D; if (D) $('dados-n').textContent = fi(D.rows.length);
    $('d-empty').hidden = has; $('d-wrap').hidden = !has; $('card-dados').querySelector('.sv-mini-lbl').hidden = !has;
    if (!has) { $('d-sel').textContent = D ? D.label() : ''; $('d-meta').textContent = ''; $('d-sum').replaceChildren(); $('d-foot').textContent = ''; $('d-filter').hidden = true; CSVD.dados = null; return; }
    $('d-sel').textContent = D.label();
    const meta = [t('d_count', { n: fi(D.rows.length) }), t('d_scope', { v: scopeLabel() })];
    if (D.all) meta.push(t('d_tip'));
    if (D.hl && D.hl.length) meta.push(t('d_hl', { v: D.hl.map((k) => (QK.includes(k) ? qLabel(k) : k === 'ka' ? qLabel('conhec_antes') : k === 'kd' ? qLabel('conhec_apos') : k === 'idx' ? t('col_idx_ficha') : k)).join(', ') }));
    $('d-meta').textContent = meta.join(' · ');
    const fb = $('d-filter'); fb.hidden = !D.filter; if (D.filter) fb.textContent = t('d_filter', { v: D.filterName ? D.filterName() : '' });
    const by = [...d3.rollup(D.rows, (v) => ({ n: v.length, idx: d3.mean(v.filter((r) => r.pre && r.idx != null), (r) => r.idx) }), (r) => r.sigla)].sort((a, b) => b[1].n - a[1].n);
    $('d-sum').replaceChildren(...by.slice(0, 40).map(([s, o]) => { const c = el('button', 'sv-chip'); c.type = 'button'; c.setAttribute('aria-pressed', String(D.course === s)); c.title = cname(s); c.append(s, B(fi(o.n))); if (o.idx != null) c.append(' · ' + f2(o.idx)); c.addEventListener('click', () => { D.course = D.course === s ? null : s; D.limit = 300; drawDados(); }); return c; }));
    if (by.length > 40) $('d-sum').append(el('span', 'sv-tblnote', '+' + (by.length - 40)));
    const cols = [['sigla', 'Sigla'], ['curso', t('col_curso')], ['turma', t('col_turma')], ['rel', t('col_ficha')], ['status', t('col_status')], ['idx', t('col_idx_ficha')], ...QK.map((k) => [k, qShort(k)]), ['ka', qShort('conhec_antes')], ['kd', qShort('conhec_apos')]];
    const hl = new Set(D.hl || []);
    $('d-head').replaceChildren(...cols.map(([k, lb]) => {
      const th = el('th', (hl.has(k) ? 'sv-hl ' : '') + (['turma', 'rel', 'idx', 'ka', 'kd'].includes(k) || QK.includes(k) ? 'r' : ''));
      if (D.sortKey === k) th.setAttribute('aria-sort', D.sortDir === 'asc' ? 'ascending' : 'descending');
      const w = el('span', 'sv-th'); const b = el('button', 'sv-sort', lb + (D.sortKey === k ? (D.sortDir === 'asc' ? ' ↑' : ' ↓') : '')); b.type = 'button';
      b.addEventListener('click', () => { if (D.sortKey === k) D.sortDir = D.sortDir === 'asc' ? 'desc' : 'asc'; else { D.sortKey = k; D.sortDir = 'asc'; } drawDados(); });
      w.append(b); if (QK.includes(k)) w.append(infoBtn('q:' + k)); else if (k === 'ka') w.append(infoBtn('q:conhec_antes')); else if (k === 'kd') w.append(infoBtn('q:conhec_apos')); else if (k === 'idx') w.append(infoBtn('indice'));
      th.append(w); return th;
    }));
    const rows = dadosRows(); const stx = STX();
    const noteCell = (x, k) => { const td = el('td', 'sv-note' + (hl.has(k) ? ' sv-hl' : ''), x == null ? '·' : String(x)); if (x != null) td.style.background = `color-mix(in srgb, ${NV[x - 1]} 35%, transparent)`; return td; };
    $('d-body').replaceChildren(...rows.slice(0, D.limit).map((r) => {
      const tr = el('tr');
      const nm = el('td', 'sv-cell-name', cname(r.sigla)); nm.title = cname(r.sigla);
      tr.append(el('td', '', r.sigla), nm, el('td', 'r', String(r.turma)), el('td', 'r', String(r.rel)), el('td', r.pre ? '' : 'sv-bad', stx[r.status] || r.status), el('td', 'r' + (hl.has('idx') ? ' sv-hl' : ''), r.idx == null ? '·' : f2(r.idx)));
      QK.forEach((k, i) => tr.append(noteCell(r.v[i], k)));
      tr.append(noteCell(r.ka, 'ka'), noteCell(r.kd, 'kd'));
      return tr;
    }));
    const foot = $('d-foot'); foot.replaceChildren(t('d_showing', { a: fi(Math.min(D.limit, rows.length)), b: fi(rows.length) }));
    if (rows.length > D.limit) { const mb = el('button', 'sv-btn', t('d_more', { n: fi(Math.min(300, rows.length - D.limit)) })); mb.type = 'button'; mb.style.marginLeft = '10px'; mb.addEventListener('click', () => { D.limit += 300; drawDados(); }); foot.append(mb); }
    CSVD.dados = { header: cols.map((c) => c[1]).concat([t('col_area')]), rows: rows.map((r) => [r.sigla, cname(r.sigla), r.turma, r.rel, stx[r.status] || r.status, r.idx == null ? null : Math.round(r.idx * 100) / 100, ...r.v, r.ka, r.kd, r.area]) };
  }
  document.querySelectorAll('[data-drill]').forEach((c) => c.addEventListener('click', (e) => {
    if (e.target.closest('.sv-i') || !SCOPE) return;
    const S = SCOPE.rows; const k = c.dataset.drill;
    if (k === 'kpi-idx') openData({ label: () => t('sel_kpi_idx'), rows: S.filter((r) => r.pre), hl: ['idx'] });
    else if (k === 'kpi-max') openData({ label: () => t('sel_max'), rows: S.filter((r) => r.pre && r.all5), hl: ['idx'] });
    else if (k === 'kpi-all') openData({ label: () => t('sel_kpi_all'), rows: S, hl: [] });
    else if (k === 'kpi-know') openData({ label: () => t('sel_know_all'), rows: S.filter((r) => r.pre && r.ka != null && r.kd != null), hl: ['ka', 'kd'] });
  }));

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
    const bandsRow = el('div', 'sv-swatches'); bandsRow.style.marginTop = '12px';
    [0, 1, 2, 3].forEach((i) => bandsRow.append(swatch(t('band_' + (i + 1)), c.bands[i] || HB[i], (v) => { c.bands[i] = v; save(); })));
    const thr = el('div', 'sv-thr');
    thr.append(el('span'), ...[1, 2, 3].map((i) => { const h = el('span', 'sv-thr-h'); const sw = el('i'); sw.style.background = HB[i]; h.append(sw, t('band_' + (i + 1))); return h; }));
    const thrRow = (lbl, a, step) => { thr.append(el('span', '', lbl)); a.forEach((v, j) => { const inp = el('input'); inp.type = 'number'; inp.step = step; inp.value = v; inp.title = t('cfg_from'); inp.addEventListener('change', () => { const n = Number(inp.value); if (isFinite(n)) { a[j] = n; a.sort((x, y) => x - y); save(); } }); thr.append(inp); }); };
    thrRow(t('cfg_thr_mean'), c.thrMean, '0.05'); thrRow(t('cfg_thr_ot'), c.thrOt, '1');
    const thrNote = el('div', 'sv-card-note'); thrNote.textContent = (Li() ? 'Each value is where the band starts ("from"). Below the first one: ' : 'Cada valor é onde a faixa começa ("a partir de"). Abaixo do primeiro: ') + t('band_1') + '.';
    abs.replaceChildren(bandsRow, thr, thrNote);
    const relRow = el('div', 'sv-thr'); relRow.style.gridTemplateColumns = 'auto minmax(0,5.2rem) minmax(0,5.2rem)';
    relRow.append(el('span'), el('span', '', t('m_media')), el('span', '', t('m_otimo')), el('span', '', t('cfg_span')));
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
  function drawKpis(S, G, filt) {
    $('k-indice').textContent = f2(S.indice);
    $('k-pips').replaceChildren(...[0, 1, 2, 3, 4].map((i) => { const p = el('div', 'sv-pip'); const f = el('i'); f.style.width = Math.max(0, Math.min(1, (S.indice ?? 0) - i)) * 100 + '%'; p.appendChild(f); return p; }));
    deltaLine($('d-indice'), S.indice, filt ? G.indice : null, 2, '');
    $('k-otimo').textContent = f1(S.pct_otimo);
    const dist = [S.pct_fraco, S.pct_regular, S.pct_bom, S.pct_muito_bom, S.pct_otimo];
    $('k-dist').replaceChildren(...dist.map((v, i) => { const s = el('span'); s.style.width = (v ?? 0) + '%'; s.style.background = NV[i]; return s; }).filter((s, i) => dist[i] > 0));
    deltaLine($('d-otimo'), S.pct_otimo, filt ? G.pct_otimo : null, 1, '%', t('pp'));
    const ab = t('k_atebom', { v: '§' }).split('§'); para($('k-atebom-line'), [ab[0], B(f1(S.pct_ate_bom)), ab[1]]);
    $('k-max').textContent = f1(S.pct_nota_maxima);
    const pp = el('div', 'sv-pip'); const fill = el('i'); fill.style.width = (S.pct_nota_maxima ?? 0) + '%'; pp.appendChild(fill); $('k-max-bar').replaceChildren(pp);
    deltaLine($('d-max'), S.pct_nota_maxima, filt ? G.pct_nota_maxima : null, 1, '%', t('pp'));
    $('k-taxa').textContent = f1(S.taxa_resposta);
    $('k-taxa').classList.toggle('sv-bad', S.taxa_resposta != null && S.taxa_resposta < 50);
    deltaLine($('d-taxa'), S.taxa_resposta, filt ? G.taxa_resposta : null, 1, '%', t('pp'));
    const tl = t('k_taxa_n', { p: '§', e: '§', f: '§' }).split('§');
    para($('k-taxa-line'), [tl[0], B(fi(S.preenchidas)), tl[1], fi(S.preenchidas + S.nao_preenchidas), tl[2], B(fi(S.faltosos)), tl[3]]);
    const ring = d3.select('#k-ring'); ring.selectAll('*').remove();
    const arc = d3.arc().innerRadius(20).outerRadius(26).cornerRadius(3);
    const gg = ring.append('g').attr('transform', 'translate(27,27)');
    gg.append('path').attr('d', arc({ startAngle: 0, endAngle: 2 * Math.PI })).style('fill', 'var(--sv-n3)');
    gg.append('path').attr('d', arc({ startAngle: 0, endAngle: 2 * Math.PI * (S.taxa_resposta ?? 0) / 100 })).style('fill', S.taxa_resposta < 50 ? 'var(--color-bad)' : 'var(--sv-accent)');
    $('k-ganho').textContent = S.ganho == null ? '—' : sgn(S.ganho, 2);
    const gd = t('k_ganho_d', { a: '§', d: '§' }).split('§'); para($('k-ganho-d'), [gd[0], B(f2(S.conhec_antes)), gd[1], B(f2(S.conhec_apos)), gd[2]]);
    const gn = t('k_ganho_n', { v: '§' }).split('§'); para($('k-ganho-n'), [gn[0], B(f1(S.pct_evoluiu)), gn[1]]);
    $('kn-antes').textContent = f2(S.conhec_antes); $('kn-apos').textContent = f2(S.conhec_apos);
    $('kn-ev').textContent = pct(S.pct_evoluiu); $('kn-ig').textContent = pct(S.pct_igual); $('kn-rg').textContent = pct(S.pct_regrediu);
  }

  // ---------- Takeaway ----------
  function drawTake(S, filt) {
    const node = $('sv-take'); node.classList.remove('dash-skeleton');
    const en = Li() === 1, lbl = scopeLabel();
    if (!S.preenchidas) {
      para(node, en ? [lbl, ' has no completed forms: of ', B(fi(S.fichas)), ' forms on record, ', B(fi(S.nao_preenchidas)), ' were not completed and ', B(fi(S.faltosos)), ' belong to absent students.']
        : [lbl, ' não tem fichas preenchidas: das ', B(fi(S.fichas)), ' fichas registradas, ', B(fi(S.nao_preenchidas)), ' não foram preenchidas e ', B(fi(S.faltosos)), ' são de alunos faltosos.']);
      return;
    }
    const its = S.items.filter((x) => x.n > 0);
    const best = [...its].sort((a, b) => b.pct5 - a.pct5)[0], worst = [...its].sort((a, b) => a.pct5 - b.pct5)[0];
    const parts = en
      ? [!filt ? 'High, consistent satisfaction: ' : lbl + ': ', 'index of ', B(f2(S.indice)), ' out of 5, with ', B(pct(S.pct_otimo), 'sv-good'), ' of answers rated "Excellent". ']
      : [!filt ? 'Satisfação alta e consistente: ' : lbl + ': ', 'índice de ', B(f2(S.indice)), ' em 5, com ', B(pct(S.pct_otimo), 'sv-good'), ' das respostas em "Ótimo". '];
    if (best && worst && best !== worst) parts.push(en
      ? ['The strongest point is ', B(qLabel(best.chave)), ' (', B(pct(best.pct5)), ' Excellent); the furthest from excellence is ', B(qLabel(worst.chave), 'sv-bad'), ' (', B(pct(worst.pct5)), '). ']
      : ['O ponto mais forte é ', B(qLabel(best.chave)), ' (', B(pct(best.pct5)), ' Ótimo); o mais distante da excelência é ', B(qLabel(worst.chave), 'sv-bad'), ' (', B(pct(worst.pct5)), '). ']);
    if (S.conhec_antes != null) parts.push(en ? ['Self-reported knowledge rises from ', B(f2(S.conhec_antes)), ' to ', B(f2(S.conhec_apos)), '. '] : ['O conhecimento declarado sobe de ', B(f2(S.conhec_antes)), ' para ', B(f2(S.conhec_apos)), '. ']);
    if (S.taxa_resposta != null && S.taxa_resposta < 70) parts.push(en ? ['The biggest risk is data collection: only ', B(pct(S.taxa_resposta), 'sv-bad'), ' of expected forms came back completed.'] : ['O maior risco está na coleta: só ', B(pct(S.taxa_resposta), 'sv-bad'), ' das fichas esperadas voltaram preenchidas.']);
    para(node, parts);
  }

  // ---------- Items ----------
  const preRows = (rows) => rows.filter((r) => r.pre);
  const qRows = (rows, qi, note) => rows.filter((r) => r.pre && (note == null ? r.v[qi] != null : r.v[qi] === note));
  function drawItens(S, G, filt, rows) {
    const box = $('chart-itens'); box.classList.remove('dash-skeleton'); clearChart(box);
    const tip = tipFor(box);
    const its = S.items.filter((r) => r.n > 0);
    const ref = filt ? new Map(G.items.map((r) => [r.chave, r])) : null;
    const lg = $('lg-itens');
    lg.replaceChildren(...[4, 3, 2, 1, 0].map((i) => { const s = el('span'); const sw = el('i'); sw.style.background = NV[i]; s.append(sw, `${i + 1} · ${noteName(i)}`); return s; }));
    if (ref) { const s = el('span'); s.append(el('i', 'sv-lg-line'), t('ref_all')); lg.appendChild(s); }
    $('itens-note').textContent = t('c_itens_n', { n: fi(S.preenchidas) });
    if (!its.length) { empty(box, t('no_resp')); return; }
    const W = box.clientWidth; if (!W) return;
    const narrow = W < 620;
    const ordem = P().ordem || 'form';
    let list = [];
    if (ordem === 'rank') list = [...its].sort((a, b) => b.pct5 - a.pct5 || b.media - a.media).map((r) => ({ t: 'row', r }));
    else if (ordem === 'pol') list = [...its].sort((a, b) => (b.dp ?? 0) - (a.dp ?? 0)).map((r) => ({ t: 'row', r }));
    else { let dim = null; its.forEach((r) => { if (r.dimensao !== dim) { dim = r.dimensao; list.push({ t: 'head', dim }); } list.push({ t: 'row', r }); }); }
    const svg = d3.select(box).insert('svg', '.sv-tip').attr('width', '100%');
    const labW = narrow ? 0 : d3.max(its, (r) => textW(svg, qLabel(r.chave), 'var(--cds-font-size-body)')) + 22;
    const statW = narrow ? 50 : 84;
    const L = Math.max(12, d3.max(its, (r) => 100 - r.pct5));
    const R = Math.max(d3.max(its, (r) => r.pct5), ref ? d3.max(its, (r) => ref.get(r.chave)?.pct5 ?? 0) : 0);
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
        g.append('text').attr('x', W).attr('y', 22).attr('text-anchor', 'end').style('font-size', 'var(--cds-font-size-caption)').style('fill', 'var(--color-fg-muted)').text(t('dim_head', { m: f2(S['media_' + d.dim]), o: pct(S['otimo_' + d.dim]) }));
        g.append('line').attr('x1', 0).attr('x2', W).attr('y1', 28).attr('y2', 28).style('stroke', 'var(--cds-chart-grid)');
        return;
      }
      const r = d.r, qi = QK.indexOf(r.chave), by = narrow ? 24 : (rowH - barH) / 2;
      const ly = narrow ? 14 : by + barH / 2 + 5;
      g.append('text').attr('x', 0).attr('y', ly).style('font-size', 'var(--cds-font-size-body)').style('fill', 'var(--color-fg)').style('cursor', 'pointer').text(qLabel(r.chave))
        .on('click', () => openData({ label: () => t('sel_q', { q: qLabel(r.chave) }), rows: qRows(rows, qi), hl: [r.chave] }));
      let cum = 0; const segs = [];
      [4, 3, 2, 1].forEach((k) => { const v = r['pct' + k] || 0; segs.push({ k, x0: -(cum + v), x1: -cum, v }); cum += v; });
      segs.push({ k: 5, x0: 0, x1: r.pct5, v: r.pct5 });
      g.selectAll('rect').data(segs.filter((s) => s.v > 0)).join('rect')
        .attr('x', (s) => x(s.x0) + (s.k === 5 ? 1 : 0.5)).attr('width', (s) => Math.max(1, x(s.x1) - x(s.x0) - 1)).attr('y', by).attr('height', barH).attr('rx', 3)
        .style('fill', (s) => NV[s.k - 1]).style('cursor', 'pointer')
        .on('mousemove', (ev) => showTip(box, tip, ev, `${qLabel(r.chave)} · ${fi(r.n)}`, [5, 4, 3, 2, 1].map((k) => [NV[k - 1], `${k} ${noteName(k - 1)}: ${pct(r['pct' + k])}`]).concat([`σ ${f2(r.dp)}`]).concat(ref ? [t('ref_all') + ': ' + pct(ref.get(r.chave)?.pct5)] : [])))
        .on('mouseleave', () => hideTip(tip))
        .on('click', (ev, s) => openData({ label: () => t('sel_note', { q: qLabel(r.chave), k: s.k, n: noteName(s.k - 1) }), rows: qRows(rows, qi, s.k), hl: [r.chave] }));
      g.append('text').attr('x', x(-(100 - r.pct5)) - 6).attr('y', by + barH / 2 + 4).attr('text-anchor', 'end').style('font-size', 'var(--cds-font-size-caption)').style('fill', 'var(--color-fg-muted)').text(pct(100 - r.pct5));
      let endX = x(r.pct5);
      if (ref && ref.get(r.chave)) { const rx = x(ref.get(r.chave).pct5); g.append('line').attr('x1', rx).attr('x2', rx).attr('y1', by - 4).attr('y2', by + barH + 4).style('stroke', 'var(--color-fg)').style('stroke-width', 2).style('pointer-events', 'none'); endX = Math.max(endX, rx); }
      g.append('text').attr('x', endX + 7).attr('y', by + barH / 2 + 4).style('font-size', 'var(--cds-font-size-caption)').style('fill', 'var(--color-fg)').style('font-weight', 'var(--cds-font-weight-medium)').text(pct(r.pct5));
      g.append('text').attr('x', W).attr('y', by + barH / 2 + 6).attr('text-anchor', 'end').style('font-family', 'var(--font-anthropic-serif)').style('font-size', '1.15rem').style('fill', 'var(--color-fg)').text(ordem === 'pol' ? f2(r.dp) : f2(r.media));
    });
  }

  // ---------- Dimensions ----------
  function drawDims(S, G, filt, rows) {
    const box = $('dims'); box.classList.remove('dash-skeleton');
    box.replaceChildren(...['programa', 'organizacao', 'instrutor'].map((k) => {
      const w = el('div', (firstDraw ? 'sv-in ' : '') + 'sv-clickable');
      w.addEventListener('click', () => openData({ label: () => t('sel_dim', { d: dimName(k) }), rows: preRows(rows), hl: DIMK[k].map((i) => QK[i]) }));
      const top = el('div', 'sv-dim-top'); top.append(el('span', 'sv-dim-name', dimName(k)), el('span', 'sv-dim-val', f2(S['media_' + k])));
      const bar = el('div', 'sv-dim-bar'); const fill = el('i'); fill.style.width = (S['otimo_' + k] ?? 0) + '%'; bar.append(fill);
      if (filt) { const m = el('em'); m.style.left = `calc(${G['otimo_' + k]}% - 1px)`; bar.append(m); }
      const sub = el('div', 'sv-dim-sub');
      const a = el('span'); a.append(B(pct(S['otimo_' + k])), t('dim_otimo'));
      const b = el('span');
      if (filt && S['otimo_' + k] != null) { const diff = S['otimo_' + k] - G['otimo_' + k]; b.className = Math.abs(diff) < 0.05 ? '' : diff > 0 ? 'sv-good' : 'sv-bad'; b.textContent = sgn(diff, 1, t('pp')) + t('vs_geral'); }
      else b.textContent = t('dim_scale');
      sub.append(a, b); w.append(top, bar, sub);
      return w;
    }));
  }

  // ---------- Radar ----------
  // Escala do radar: completa (1–5 / 0–100%), zoom automático ou personalizada (parâmetros rmin/rmax e pmin/pmax).
  function radarScale(metr, all, force) {
    const p = P(), mode = force || p.rscale || 'full', m = metr === 'media';
    const B0 = m ? 1 : 0, B1 = m ? 5 : 100;
    if (mode === 'auto') {
      const mn = d3.min(all), mx = d3.max(all);
      const lo = m ? Math.max(1, Math.floor((mn - 0.15) * 4) / 4) : Math.max(0, Math.floor((mn - 5) / 10) * 10);
      const hi = m ? Math.min(5, Math.max(lo + 0.5, Math.ceil((mx + 0.05) * 4) / 4)) : Math.min(100, Math.max(lo + 10, Math.ceil((mx + 2) / 10) * 10));
      return { lo, hi };
    }
    if (mode === 'custom') {
      let lo = Number(m ? p.rmin : p.pmin), hi = Number(m ? p.rmax : p.pmax);
      if (!Number.isFinite(lo)) lo = m ? 3 : 40; if (!Number.isFinite(hi)) hi = B1;
      lo = Math.max(B0, Math.min(B1, lo)); hi = Math.max(B0, Math.min(B1, hi));
      if (hi - lo < (m ? 0.1 : 1)) hi = Math.min(B1, lo + (m ? 0.5 : 10)), lo = Math.min(lo, hi - (m ? 0.5 : 10));
      return { lo, hi };
    }
    return { lo: B0, hi: B1 };
  }
  function drawRadar(S, G, filt, rows) {
    const box = $('chart-radar'); box.classList.remove('dash-skeleton'); box.style.minHeight = '0'; clearChart(box);
    const tip = tipFor(box);
    const metr = P().rmetric || 'media';
    const f = F();
    const val = (it) => (metr === 'media' ? it.media : it.pct5);
    let series = [];
    if (f.cursos.length >= 2 && f.cursos.length <= 6) {
      const by = d3.group(rows, (r) => r.sigla);
      series = f.cursos.filter((s) => by.has(s)).map((s, i) => { const rs = by.get(s); return { name: s + ' · ' + cname(s), short: s, a: agg(rs), rows: rs, color: SERIES[i % SERIES.length] }; }).filter((s) => s.a.preenchidas > 0);
    } else if (S.preenchidas) series = [{ name: filt ? scopeLabel() : t('radar_ref'), short: '', a: S, rows, color: SERIES[0] }];
    const showRef = filt;
    const all = series.flatMap((s) => s.a.items.map(val)).concat(showRef ? G.items.map(val) : []).filter((v) => v != null);
    const lg = $('lg-radar');
    lg.replaceChildren(...series.map((s) => { const sp = el('span'); const sw = el('i'); sw.style.background = s.color; sp.append(sw, s.name); return sp; }));
    if (showRef) { const sp = el('span'); const sw = el('i'); sw.style.background = 'transparent'; sw.style.border = '2px dashed var(--color-fg-muted)'; sp.append(sw, t('radar_ref')); lg.append(sp); }
    CSVD.radar = { header: [t('c_perguntas'), ...series.map((s) => s.name), ...(showRef ? [t('radar_ref')] : [])], rows: QK.map((k, i) => [qLabel(k), ...series.map((s) => val(s.a.items[i])), ...(showRef ? [val(G.items[i])] : [])]) };
    if (!series.length || !all.length) { $('radar-note').textContent = ''; empty(box, t('no_resp')); return; }
    const W = box.clientWidth; if (!W) return;
    const sc = radarScale(metr, all);
    const lo = sc.lo, hi = sc.hi, base = metr === 'media' ? 1 : 0;
    const narrow = W < 560;
    const R = Math.max(80, Math.min(narrow ? W / 2 - 58 : 175, W / 2 - (narrow ? 58 : 130)));
    const H = Math.round(R * 2 + 56);
    const svg = d3.select(box).insert('svg', '.sv-tip').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    const cx = W / 2, cy = R + 26;
    const r = d3.scaleLinear([lo, hi], [0, R]).clamp(true);
    const ang = (i) => (i / QK.length) * 2 * Math.PI - Math.PI / 2;
    const pt = (i, v) => [cx + Math.cos(ang(i)) * r(v), cy + Math.sin(ang(i)) * r(v)];
    const fmtS = (v) => (metr === 'media' ? f2(v) : loc(v, 0) + '%');
    const ticks = d3.ticks(lo, hi, metr === 'media' && hi - lo <= 1 ? 5 : 4).filter((v) => v > lo + 1e-9);
    ticks.forEach((tv) => {
      svg.append('path').attr('d', d3.line()(QK.map((_, i) => pt(i, tv)).concat([pt(0, tv)]))).style('fill', 'none').style('stroke', 'var(--cds-chart-grid)');
      const la = -Math.PI / 2 + Math.PI / QK.length;
      svg.append('text').attr('x', cx + Math.cos(la) * r(tv) + 3).attr('y', cy + Math.sin(la) * r(tv) - 3).style('font-size', '10px').style('fill', 'var(--color-fg-muted)').text(fmtS(tv));
    });
    QK.forEach((k, i) => {
      const [x2, y2] = pt(i, hi);
      svg.append('line').attr('x1', cx).attr('y1', cy).attr('x2', x2).attr('y2', y2).style('stroke', 'var(--cds-chart-grid)');
      const lx = cx + Math.cos(ang(i)) * (R + 12), ly = cy + Math.sin(ang(i)) * (R + 12);
      const anchor = Math.abs(Math.cos(ang(i))) < 0.2 ? 'middle' : Math.cos(ang(i)) > 0 ? 'start' : 'end';
      const dy = Math.sin(ang(i)) < -0.9 ? -2 : Math.sin(ang(i)) > 0.9 ? 10 : 4;
      svg.append('text').attr('x', lx).attr('y', ly + dy).attr('text-anchor', anchor).style('font-size', 'var(--cds-font-size-caption)').style('fill', 'var(--color-fg)').style('cursor', 'pointer').text(narrow ? qShort(k) : qLabel(k))
        .on('click', () => openData({ label: () => t('sel_q', { q: qLabel(k) }), rows: qRows(rows, i), hl: [k] }));
    });
    const rn = $('radar-note'); rn.replaceChildren(t('scale_from', { a: fmtS(lo), b: fmtS(hi) }));
    if (lo > base) { const w = el('b', '', ' · ' + t('scale_zoom', { a: fmtS(lo), z: fmtS(base) })); w.style.color = 'var(--color-warn)'; rn.append(w); }
    if (showRef) { const pts = G.items.map((it, i) => pt(i, val(it) ?? lo)); svg.append('path').attr('d', d3.line()(pts.concat([pts[0]]))).style('fill', 'none').style('stroke', 'var(--color-fg-muted)').style('stroke-width', 1.5).attr('stroke-dasharray', '5 4'); }
    series.forEach((s) => {
      const pts = s.a.items.map((it, i) => pt(i, val(it) ?? lo));
      svg.append('path').attr('d', d3.line()(pts.concat([pts[0]]))).style('fill', `color-mix(in srgb, ${s.color} ${series.length > 1 ? 6 : 14}%, transparent)`).style('stroke', s.color).style('stroke-width', 2).style('stroke-linejoin', 'round');
      s.a.items.forEach((it, i) => {
        const [px, py] = pts[i];
        svg.append('circle').attr('cx', px).attr('cy', py).attr('r', 4.5).style('fill', s.color).style('stroke', 'var(--color-panel)').style('stroke-width', 1.5).style('cursor', 'pointer')
          .on('mousemove', (ev) => showTip(box, tip, ev, `${qLabel(it.chave)}${s.short ? ' · ' + s.short : ''}`, [`${t('ax_mean')} ${f2(it.media)} · ${pct(it.pct5)} ${noteName(4)}`, showRef ? `${t('radar_ref')}: ${metr === 'media' ? f2(G.items[i].media) : pct(G.items[i].pct5)}` : `n = ${fi(it.n)}`]))
          .on('mouseleave', () => hideTip(tip))
          .on('click', () => openData({ label: () => t('sel_q', { q: qLabel(it.chave) }) + (s.short ? ' · ' + s.short : ''), rows: qRows(s.rows, i), hl: [it.chave] }));
      });
    });
  }

  // ---------- Knowledge ----------
  function drawConh(S, rows) {
    const box = $('chart-matriz-conh'); box.classList.remove('dash-skeleton'); clearChart(box);
    const tip = tipFor(box);
    const cellsA = S.cells || [];
    const distBox = $('kn-dist');
    const names = [0, 1, 2, 3, 4].map(noteName);
    CSVD.conh = { header: [t('kn_antes') + ' \\ ' + t('kn_apos'), ...names], rows: [1, 2, 3, 4, 5].map((a) => [names[a - 1], ...[1, 2, 3, 4, 5].map((d) => (cellsA.find((c) => c.antes === a && c.apos === d) || { fichas: 0 }).fichas)]) };
    if (!cellsA.length) { empty(box, t('no_know')); distBox.replaceChildren(); return; }
    const W = box.clientWidth; if (!W) return;
    const cell = new Map(cellsA.map((r) => [r.antes + '|' + r.apos, r]));
    const maxP = d3.max(cellsA, (r) => r.pct);
    const svg = d3.select(box).insert('svg', '.sv-tip').attr('width', '100%');
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
      const aa = a, dd = d;
      svg.append('rect').attr('x', xx + 1.5).attr('y', yy + 1.5).attr('width', cs - 3).attr('height', cs - 3).attr('rx', 5)
        .style('fill', p > 0 ? `color-mix(in srgb, ${base} ${amt.toFixed(0)}%, var(--color-panel))` : 'color-mix(in srgb, var(--color-fg) 3%, var(--color-panel))')
        .style('stroke', a === d ? 'var(--cds-chart-axis)' : 'none').style('stroke-dasharray', a === d ? '3 2' : null).style('cursor', p > 0 ? 'pointer' : 'default')
        .on('mousemove', (ev) => showTip(box, tip, ev, t('kn_tip', { a: names[aa - 1], d: names[dd - 1] }), [`${fi(c ? c.fichas : 0)} (${pct(p)})`, dd > aa ? t('kn_up', { n: dd - aa }) : dd < aa ? t('kn_down') : t('kn_same')]))
        .on('mouseleave', () => hideTip(tip))
        .on('click', () => { if (p > 0) openData({ label: () => t('sel_know', { a: names[aa - 1], d: names[dd - 1] }), rows: rows.filter((r) => r.pre && r.ka === aa && r.kd === dd), hl: ['ka', 'kd'] }); });
      if (p >= 0.5) svg.append('text').attr('x', xx + cs / 2).attr('y', yy + cs / 2 + 4).attr('text-anchor', 'middle').style('pointer-events', 'none').style('font-size', cs < 46 ? '10px' : 'var(--cds-font-size-caption)').style('font-weight', 'var(--cds-font-weight-medium)').style('fill', amt > 62 ? 'var(--color-bg)' : 'var(--color-fg)').text(f1(p) + '%');
    }
    const tot = d3.sum(cellsA, (r) => r.fichas);
    const marg = (key) => [1, 2, 3, 4, 5].map((v) => (d3.sum(cellsA.filter((r) => r[key] === v), (r) => r.fichas) / tot) * 100);
    distBox.replaceChildren(...[[t('kn_antes'), 'antes', 'ka', S.conhec_antes], [t('kn_apos'), 'apos', 'kd', S.conhec_apos]].map(([lbl, key, rk, m]) => {
      const row = el('div', 'sv-dist-row'); row.append(el('span', '', lbl));
      const st = el('div', 'sv-stack');
      marg(key).forEach((v, i) => { if (v <= 0) return; const s = el('span', 'sv-clickable'); s.style.width = v + '%'; s.style.background = NV[i]; s.title = `${names[i]}: ${pct(v)}`; s.addEventListener('click', () => openData({ label: () => t('sel_know1', { w: lbl.toLowerCase(), k: names[i] }), rows: rows.filter((r) => r.pre && r[rk] === i + 1 && r.ka != null && r.kd != null), hl: [rk] })); st.append(s); });
      row.append(st, el('span', 'sv-num', f2(m)));
      return row;
    }));
    const lgd = el('div', 'sv-legend'); lgd.style.margin = '6px 0 0';
    names.forEach((n, i) => { const s = el('span'); const sw = el('i'); sw.style.background = NV[i]; s.append(sw, n); lgd.append(s); });
    distBox.append(lgd);
  }

  // ---------- Priority matrix ----------
  function drawPrioridade(S, rows) {
    const box = $('chart-prioridade'); box.classList.remove('dash-skeleton'); clearChart(box);
    const tip = tipFor(box);
    const its = S.items.filter((r) => r.correlacao != null && r.n > 0);
    CSVD.prio = { header: [t('c_perguntas'), t('m_otimo'), 'r', t('ax_mean'), 'n'], rows: S.items.map((r) => [qLabel(r.chave), r.pct5, r.correlacao, r.media, r.n]) };
    if (its.length < 3) { empty(box, t('prio_small')); return; }
    const W = box.clientWidth; if (!W) return;
    const H = 360, m = { t: 14, r: 16, b: 42, l: 46 };
    const svg = d3.select(box).insert('svg', '.sv-tip').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    const xe = d3.extent(its, (c) => c.pct5), ye = d3.extent(its, (c) => c.correlacao);
    const px = Math.max(1.5, (xe[1] - xe[0]) * 0.18), py = Math.max(0.02, (ye[1] - ye[0]) * 0.18);
    const x = d3.scaleLinear([xe[0] - px, xe[1] + px], [m.l, W - m.r]);
    const y = d3.scaleLinear([ye[0] - py, ye[1] + py], [H - m.b, m.t]);
    const mx = d3.mean(its, (c) => c.pct5), my = d3.mean(its, (c) => c.correlacao);
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', Math.max(0, x(mx) - m.l)).attr('height', Math.max(0, y(my) - m.t)).attr('rx', 6).style('fill', 'color-mix(in srgb, var(--color-bad) 9%, transparent)');
    svg.append('line').attr('x1', x(mx)).attr('x2', x(mx)).attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--cds-chart-reference)').attr('stroke-dasharray', '3 3');
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(my)).attr('y2', y(my)).style('stroke', 'var(--cds-chart-reference)').attr('stroke-dasharray', '3 3');
    const q = (tx, ty, anchor, txt, col) => svg.append('text').attr('x', tx).attr('y', ty).attr('text-anchor', anchor).style('font-size', '11px').style('letter-spacing', '.06em').style('text-transform', 'uppercase').style('fill', col).text(txt);
    q(m.l + 8, m.t + 16, 'start', t('q_prio'), 'var(--color-bad)'); q(W - m.r - 6, m.t + 16, 'end', t('q_keep'), 'var(--color-fg-muted)');
    q(m.l + 8, H - m.b - 8, 'start', t('q_mon'), 'var(--color-fg-muted)'); q(W - m.r - 6, H - m.b - 8, 'end', t('q_diff'), 'var(--color-fg-muted)');
    const xa = svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(Math.max(3, Math.floor(W / 90))).tickFormat((v) => loc(v, 0) + '%').tickSizeOuter(0));
    const ya = svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat((v) => f2(v)).tickSizeOuter(0));
    styleAxis(xa); styleAxis(ya);
    svg.append('text').attr('x', W - m.r).attr('y', H - 6).attr('text-anchor', 'end').style('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)').text(t('ax_exc'));
    svg.append('text').attr('transform', `translate(11,${m.t}) rotate(-90)`).attr('text-anchor', 'end').style('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)').text(t('ax_infl'));
    const isP = (c) => c.pct5 < mx && c.correlacao > my;
    const placed = its.map((c) => ({ x: x(c.pct5) - 8, y: y(c.correlacao) + 8, w: 16, h: 16 }));
    its.slice().sort((a, b) => y(a.correlacao) - y(b.correlacao)).forEach((c) => {
      const cx = x(c.pct5), cy = y(c.correlacao), qi = QK.indexOf(c.chave);
      const col = isP(c) ? 'var(--color-bad)' : c.pct5 >= mx ? 'var(--sv-accent)' : 'var(--color-fg-muted)';
      const go = () => openData({ label: () => t('sel_q', { q: qLabel(c.chave) }), rows: qRows(rows, qi), hl: [c.chave] });
      svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', isP(c) ? 7 : 5.5).style('fill', col).style('stroke', 'var(--color-panel)').style('stroke-width', 2).style('cursor', 'pointer')
        .on('mousemove', (ev) => showTip(box, tip, ev, `${qLabel(c.chave)} · ${dimName(c.dimensao)}`, [`${pct(c.pct5)} ${noteName(4)} · ${t('ax_mean')} ${f2(c.media)}`, `r = ${f2(c.correlacao)}`]))
        .on('mouseleave', () => hideTip(tip)).on('click', go);
      const tt = svg.append('text').style('font-size', 'var(--cds-font-size-caption)').style('fill', 'var(--color-fg)').style('cursor', 'pointer').style('font-weight', isP(c) ? 'var(--cds-font-weight-medium)' : null).text(qLabel(c.chave)).on('click', go);
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
  const lim = (mu, sd) => ({ lo: (n, z) => mu - (z * sd) / Math.sqrt(n), hi: (n, z) => Math.min(5, mu + (z * sd) / Math.sqrt(n)) });
  function funnel(box, pts, mu, sd, opts) {
    clearChart(box);
    const tip = tipFor(box);
    const W = box.clientWidth; if (!W || !pts.length) return;
    const H = opts.H || 360, m = { t: 14, r: 18, b: 42, l: 46 };
    const svg = d3.select(box).insert('svg', '.sv-tip').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    const nMin = Math.max(1, d3.min(pts, (p) => p.n)), nMax = Math.max(2, d3.max(pts, (p) => p.n));
    const x = d3.scaleLog([Math.max(1, nMin * 0.8), nMax * 1.25], [m.l, W - m.r]);
    const { lo, hi } = lim(mu, sd);
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
        .on('click', () => drillGroup(c.g));
    });
    const placed = [];
    sorted.filter((c) => c.on && (cls(c) === 'b2' || cls(c) === 'b1' || c.sel || opts.labelAll)).forEach((c) => {
      const cx = x(c.n), cy = y(c.v);
      const tt = svg.append('text').style('font-size', '11px').style('fill', 'var(--color-fg)').style('pointer-events', 'none').text(c.short);
      const tw = tt.node().getComputedTextLength();
      let tx = cx + 9 + tw < W - m.r ? cx + 9 : cx - 9 - tw, ty = cy + 4, tries = 0;
      while (placed.some((qq) => Math.abs(qq.y - ty) < 11 && !(tx + tw < qq.x || tx > qq.x + qq.w)) && tries < 6) { ty += 11; tries++; }
      placed.push({ x: tx, y: ty, w: tw });
      tt.attr('x', tx).attr('y', ty);
    });
    return cls;
  }
  function drawFunil(G, scopeSiglas, filt) {
    const box = $('chart-funil'); box.classList.remove('dash-skeleton');
    const one = scopeSiglas.size === 1 ? [...scopeSiglas][0] : null;
    const cg = DB.courseGroups.filter((g) => g.preenchidas > 0 && g.indice != null);
    const pts = cg.map((g) => ({ n: g.preenchidas, v: g.indice, ot: g.pct_otimo, g, title: `${g.sigla} · ${cname(g.sigla)}`, short: g.sigla, sel: g.sigla === one, on: !filt || scopeSiglas.has(g.sigla) }));
    funnel(box, pts, G.indice, G.dp_indice, { meanLabel: t('mean_all', { v: f2(G.indice) }) });
    const { lo } = lim(G.indice, G.dp_indice);
    $('how-funil').textContent = t('how_funil', { a: f2(lo(10, 1.96)), b: f2(lo(100, 3.09)) });
    CSVD.funil = { header: ['Sigla', t('col_curso'), t('col_fichas'), t('col_indice'), t('m_otimo'), 'Status'], rows: cg.map((g) => [g.sigla, cname(g.sigla), g.preenchidas, g.indice, g.pct_otimo, g.indice < lo(g.preenchidas, 3.09) ? t('f_b2') : g.indice < lo(g.preenchidas, 1.96) ? t('f_b1') : t('f_n')]) };
  }

  // ---------- Classes consistency ----------
  function drawTurmas(rows) {
    const box = $('chart-turmas'); box.classList.remove('dash-skeleton'); clearChart(box);
    const tmin = Math.max(3, minN());
    const bySigla = d3.group(rows, (r) => r.sigla);
    if (bySigla.size === 1) {
      const [sigla, rs] = [...bySigla][0];
      const course = agg(rs);
      $('turmas-title').textContent = t('c_turmas_one', { c: sigla });
      $('turmas-note').textContent = t('c_turmas_one_n');
      const ts = groups(rs, 'turma', true).filter((g) => g.indice != null);
      CSVD.turmas = { header: [t('col_turma'), t('col_fichas'), t('col_indice'), t('m_otimo')], rows: ts.map((g) => [g.turma, g.preenchidas, g.indice, g.pct_otimo]) };
      if (ts.length < 2) { empty(box, t('turmas_one_few')); return; }
      const pts = ts.map((g) => ({ n: g.preenchidas, v: g.indice, ot: g.pct_otimo, g, title: gFull(g), short: 'T' + g.turma, sel: false, on: true }));
      funnel(box, pts, course.indice, course.dp_indice || DB.G.dp_indice, { meanLabel: t('course_mean', { v: f2(course.indice) }), labelAll: ts.length <= 25, H: 340 });
      return;
    }
    $('turmas-title').textContent = t('c_turmas_all');
    $('turmas-note').textContent = t('c_turmas_all_n', { n: tmin });
    const courses = [...bySigla].map(([s, rs]) => {
      const c = agg(rs); const ts = groups(rs, 'turma', true).filter((g) => g.preenchidas >= tmin && g.indice != null);
      return { sigla: s, c, rows: rs, ts, amp: ts.length ? d3.max(ts, (x) => x.indice) - d3.min(ts, (x) => x.indice) : 0 };
    }).filter((d) => d.ts.length >= 3).sort((a, b) => b.amp - a.amp);
    CSVD.turmas = { header: ['Sigla', t('col_curso'), t('col_turma'), t('col_fichas'), t('col_indice'), t('amp')], rows: courses.flatMap((d) => d.ts.map((g) => [d.sigla, cname(d.sigla), g.turma, g.preenchidas, g.indice, d.amp])) };
    if (!courses.length) { empty(box, t('turmas_none')); return; }
    const tip = tipFor(box);
    const W = box.clientWidth; if (!W) return;
    const svg = d3.select(box).insert('svg', '.sv-tip').attr('width', '100%');
    const narrow = W < 640;
    const labW = narrow ? 0 : Math.min(340, d3.max(courses, (d) => textW(svg, d.sigla + ' · ' + cname(d.sigla), 'var(--cds-font-size-caption)')) + 16);
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
      const g = svg.append('g');
      const name = d.sigla + ' · ' + cname(d.sigla);
      const lbl = g.append('text').attr('x', 0).attr('y', narrow ? yy - 14 : yy + 4).style('font-size', 'var(--cds-font-size-caption)').style('fill', 'var(--color-fg)').style('cursor', 'pointer').text(name)
        .on('click', () => setFilter({ cursos: [d.sigla], turmas: [] }));
      { const maxW = narrow ? W - 4 : labW - 12; let s = name; while (lbl.node().getComputedTextLength() > maxW && s.length > 8) { s = s.slice(0, -2); lbl.text(s + '…'); } }
      lbl.append('title').text(name);
      const mn = d3.min(d.ts, (q) => q.indice), mxv = d3.max(d.ts, (q) => q.indice);
      g.append('line').attr('x1', x(mn)).attr('x2', x(mxv)).attr('y1', yy).attr('y2', yy).style('stroke', 'var(--cds-chart-axis)').style('stroke-width', 2);
      if (d.c.indice != null) g.append('line').attr('x1', x(d.c.indice)).attr('x2', x(d.c.indice)).attr('y1', yy - 7).attr('y2', yy + 7).style('stroke', 'var(--color-fg)').style('stroke-width', 2);
      d.ts.forEach((q) => {
        g.append('circle').attr('cx', x(q.indice)).attr('cy', yy).attr('r', 5).style('fill', HB[Math.max(0, band(q.indice, 'media'))]).style('stroke', 'var(--color-panel)').style('stroke-width', 1.5).style('cursor', 'pointer')
          .on('mousemove', (ev) => showTip(box, tip, ev, name, [`${t('turma_x', { t: q.turma })} · ${t('tip_forms_idx', { n: fi(q.preenchidas), i: f2(q.indice) })}`, t('tip_otimo', { v: pct(q.pct_otimo) })]))
          .on('mouseleave', () => hideTip(tip))
          .on('click', () => drillGroup(q));
      });
      g.append('text').attr('x', W).attr('y', yy + 4).attr('text-anchor', 'end').style('font-size', 'var(--cds-font-size-caption)').style('font-weight', 'var(--cds-font-weight-medium)').style('fill', d.amp >= 0.5 ? 'var(--color-bad)' : 'var(--color-fg)').text(f2(d.amp));
    });
  }

  // ---------- Participation ----------
  function drawParticipacao(GR, lvl) {
    const box = $('part-list'); box.classList.remove('dash-skeleton');
    const rows = GR.slice().sort((a, b) => (a.taxa_resposta ?? -1) - (b.taxa_resposta ?? -1) || b.fichas - a.fichas);
    $('part-title').textContent = t('c_part', { u: lvl === 'area' ? t('u_area') : lvl === 'curso' ? t('u_curso') : t('u_turma') });
    $('lg-part').replaceChildren(...[[t('st_pre'), 'var(--sv-accent)'], [t('st_nao'), 'var(--sv-n3)'], [t('st_fal'), 'var(--sv-n2)']].map(([tx, c]) => { const s = el('span'); const sw = el('i'); sw.style.background = c; s.append(sw, tx); return s; }));
    CSVD.part = { header: [t(lvl === 'area' ? 'col_area' : lvl === 'curso' ? 'col_curso' : 'col_turma'), t('col_fichas'), t('st_pre'), t('st_nao'), t('st_fal'), t('k_taxa') + ' (%)'], rows: rows.map((g) => [gFull(g), g.fichas, g.preenchidas, g.nao_preenchidas, g.faltosos, g.taxa_resposta]) };
    if (!rows.length) { box.replaceChildren(el('div', 'sv-empty', '—')); return; }
    const card = $('card-participacao');
    box.replaceChildren(...rows.map((g) => {
      const row = el('div', 'sv-part-row');
      const nm = el('div', 'sv-part-name');
      nm.append(gFull(g), el('small', '', t('n_forms', { n: fi(g.fichas) })));
      const st = el('div', 'sv-stack');
      [[g.preenchidas, 'var(--sv-accent)', 'Preenchido', 'st_pre'], [g.nao_preenchidas, 'var(--sv-n3)', 'Não preenchido', 'st_nao'], [g.faltosos, 'var(--sv-n2)', 'Faltoso', 'st_fal']].forEach(([v, c, stv, lk]) => {
        if (!v) return; const s = el('span'); s.style.width = (v / g.fichas) * 100 + '%'; s.style.background = c;
        s.addEventListener('click', (e) => { e.stopPropagation(); drillGroup(g, { rows: g.rows.filter((r) => r.status === stv), label: () => t('sel_status', { g: gFull(g), s: t(lk) }) }); });
        st.append(s);
      });
      const rate = el('div', 'sv-part-rate' + (g.taxa_resposta != null && g.taxa_resposta < 50 ? ' sv-bad' : ''), pct(g.taxa_resposta));
      row.append(nm, st, rate);
      row.addEventListener('click', () => drillGroup(g));
      row.addEventListener('mousemove', (ev) => showTip(card, tipFor(card), ev, gFull(g), [['var(--sv-accent)', `${t('st_pre')}: ${fi(g.preenchidas)}`], ['var(--sv-n3)', `${t('st_nao')}: ${fi(g.nao_preenchidas)}`], ['var(--sv-n2)', `${t('st_fal')}: ${fi(g.faltosos)} (${pct(g.taxa_ausencia)})`]]));
      row.addEventListener('mouseleave', () => hideTip(tipFor(card)));
      return row;
    }));
  }

  // ---------- Heatmap ----------
  const thLabel = (txt, tipKey, cls) => { const th = el('th', cls || ''); const w = el('span', 'sv-th'); w.append(txt); if (tipKey) w.append(infoBtn(tipKey)); th.append(w); return th; };
  function heatLegend(metr, hidden, lvl) {
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
    if (hidden > 0) { const u = lvl === 'turma' ? (hidden > 1 ? 'u_turmas' : 'u_turma') : (hidden > 1 ? 'u_cursos' : 'u_curso'); sc.append(el('span', '', t('heat_hidden', { n: hidden, u: t(u), m: minN() }))); }
  }
  function drawHeat(GR, G, lvl) {
    const wrap = $('heat-wrap'); wrap.classList.remove('dash-skeleton');
    const mN = minN(), metr = P().metrica || 'media';
    const all = GR.filter((g) => g.preenchidas > 0);
    const rows = all.filter((g) => g.preenchidas >= mN).sort((a, b) => (metr === 'media' ? b.indice - a.indice : b.pct_otimo - a.pct_otimo));
    heatLegend(metr, all.length - rows.length, lvl);
    const mLabel = metr === 'media' ? t('heat_mean_lbl') : t('heat_otimo_lbl');
    $('heat-note').textContent = UI.cfg.mode === 'abs' ? t('heat_abs', { m: mLabel }) : t('heat_rel', { m: mLabel, s: metr === 'media' ? f2(UI.cfg.spanMean) : loc(UI.cfg.spanOt, 0) + (Li() ? ' pp' : ' p.p.') });
    if (!rows.length) { wrap.replaceChildren(el('div', 'sv-empty', t('heat_none'))); CSVD.heat = null; return; }
    const ref = G.items;
    const val = (it) => (it ? (metr === 'media' ? it.media : it.pct5) : null);
    const fmt = (v) => (v == null ? '—' : metr === 'media' ? f2(v) : loc(v, 0) + '%');
    const tbl = el('table', 'sv-heat');
    const thead = el('thead');
    const h1 = el('tr'); h1.append(el('th'), el('th'), el('th'));
    [['programa', 3], ['organizacao', 4], ['instrutor', 3]].forEach(([n, c]) => { const th = el('th', '', dimName(n)); th.colSpan = c; th.style.borderBottom = '1px solid var(--color-border-line)'; h1.append(th); });
    [...h1.children].forEach((th) => { th.style.position = 'static'; });
    const colName = lvl === 'turma' ? t('col_turma') : lvl === 'area' ? t('col_area') : t('col_curso');
    const h2 = el('tr');
    h2.append(thLabel(colName), thLabel(t('col_fichas'), 'fichas'), thLabel(metr === 'media' ? t('col_indice') : t('col_otimo_geral'), metr === 'media' ? 'indice' : 'otimo'));
    QK.forEach((k) => h2.append(thLabel(qShort(k), 'q:' + k)));
    thead.append(h1, h2);
    const tb = el('tbody');
    const gi = metr === 'media' ? G.indice : G.pct_otimo;
    const csvRows = [];
    rows.forEach((g) => {
      const tr = el('tr');
      const nm = el('td', '', gFull(g)); nm.title = nm.textContent; nm.addEventListener('click', () => drillGroup(g));
      const iv = metr === 'media' ? g.indice : g.pct_otimo;
      const idx = el('td', 'sv-heat-idx', fmt(iv)); idx.style.background = cellFill(iv, gi, metr); idx.addEventListener('click', () => drillGroup(g, { rows: preRows(g.rows), hl: ['idx'] }));
      const fc = el('td', '', fi(g.preenchidas)); fc.addEventListener('click', () => drillGroup(g));
      tr.append(nm, fc, idx);
      const vals = g.items.map(val);
      QK.forEach((k, j) => { const v = vals[j]; const td = el('td', '', fmt(v)); td.style.background = cellFill(v, val(ref[j]), metr); td.addEventListener('click', () => drillGroup(g, { rows: qRows(g.rows, j), hl: [k], label: () => t('sel_group_q', { g: gFull(g), q: qLabel(k) }) })); tr.append(td); });
      tb.append(tr);
      csvRows.push([gFull(g), g.preenchidas, iv, ...vals]);
    });
    const refRow = el('tr'); refRow.style.cursor = 'default';
    const rn = el('td', '', t('ref_row')); rn.style.color = 'var(--color-fg-muted)';
    refRow.append(rn, el('td', '', fi(G.preenchidas)), el('td', 'sv-heat-idx', fmt(gi)));
    QK.forEach((k, j) => refRow.append(el('td', '', fmt(val(ref[j])))));
    [...refRow.children].forEach((td) => { td.style.borderTop = '1px solid var(--color-border-line)'; td.style.borderRadius = '0'; });
    tb.append(refRow);
    tbl.append(thead, tb);
    wrap.replaceChildren(tbl);
    CSVD.heat = { header: [colName, t('col_fichas'), metr === 'media' ? t('col_indice') : t('col_otimo_geral'), ...QK.map(qLabel)], rows: csvRows.concat([[t('ref_row'), G.preenchidas, gi, ...ref.map(val)]]) };
  }

  // ---------- Ranking ----------
  const sortState = { key: 'indice', dir: 'desc' };
  let search = '';
  let LAST = null;
  $('rank-search').addEventListener('input', (e) => { search = e.target.value.trim().toLowerCase(); if (LAST) drawRanking(LAST.GR, LAST.lvl); });
  const COLS = [
    { f: 'nome', t: 'col_curso', type: 's' },
    { f: 'area', t: 'col_area', type: 's', opt: true, tip: 'area' },
    { f: 'preenchidas', t: 'col_fichas', type: 'n', r: true, tip: 'fichas' },
    { f: 'taxa_resposta', t: 'col_resp', type: 'n', r: true, opt: true, tip: 'taxa' },
    { f: 'indice', t: 'col_indice', type: 'n', tip: 'indice' },
    { f: 'pct_otimo', t: 'm_otimo', type: 'n', r: true, tip: 'otimo' },
    { f: 'ganho', t: 'col_ganho', type: 'n', r: true, opt: true, tip: 'ganho' },
    { f: 'item_mais_fraco', t: 'col_fraca', type: 's', opt: true, tip: 'fraca' },
  ];
  function drawRanking(GR, lvl) {
    LAST = { GR, lvl };
    const wrap = $('rank-wrap'); wrap.classList.remove('dash-skeleton');
    const mN = minN();
    const all = GR.filter((g) => g.preenchidas > 0);
    $('rank-title').textContent = lvl === 'turma' ? t('c_rank_t', { c: [...new Set(all.map((g) => g.sigla))].slice(0, 3).join(', ') }) : lvl === 'area' ? t('c_rank') + ' · ' + t('grp_area') : t('c_rank');
    let rows = all.filter((g) => g.preenchidas >= mN);
    if (search) rows = rows.filter((g) => (gFull(g) + ' ' + g.area).toLowerCase().includes(search));
    const c = COLS.find((x) => x.f === sortState.key);
    const sv = (g, f) => (f === 'nome' ? (lvl === 'turma' ? g.sigla + String(g.turma).padStart(4, '0') : gName(g)) : f === 'item_mais_fraco' ? (g[f] ? qLabel(g[f]) : null) : g[f]);
    rows.sort((a, b) => { const va = sv(a, c.f), vb = sv(b, c.f); if (va == null) return 1; if (vb == null) return -1; const o = c.type === 'n' ? va - vb : String(va).localeCompare(String(vb), LOC(), { numeric: true }); return sortState.dir === 'asc' ? o : -o; });
    const colName = lvl === 'turma' ? t('col_turma') : lvl === 'area' ? t('col_area') : t('col_curso');
    $('rank-head').replaceChildren(...COLS.map((col) => {
      const th = el('th', (col.r ? 'r ' : '') + (col.opt ? 'sv-opt' : ''));
      if (sortState.key === col.f) th.setAttribute('aria-sort', sortState.dir === 'asc' ? 'ascending' : 'descending');
      const w = el('span', 'sv-th');
      const b = el('button', 'sv-sort', (col.f === 'nome' ? colName : t(col.t)) + (sortState.key === col.f ? (sortState.dir === 'asc' ? ' ↑' : ' ↓') : ''));
      b.type = 'button';
      b.addEventListener('click', () => { if (sortState.key === col.f) sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc'; else { sortState.key = col.f; sortState.dir = col.type === 'n' ? 'desc' : 'asc'; } drawRanking(GR, lvl); });
      w.append(b); if (col.tip) w.append(infoBtn(col.tip));
      th.append(w); return th;
    }));
    const vals = all.map((g) => g.indice).filter((v) => v != null);
    const lo = vals.length ? Math.max(1, Math.floor((d3.min(vals) - 0.1) * 10) / 10) : 1;
    $('rank-body').replaceChildren(...rows.map((g) => {
      const tr = el('tr');
      const nm = el('td'); const d = el('div', 'sv-cell-name', lvl === 'turma' ? gFull(g) : gName(g)); if (g.nivel === 'curso') d.append(el('small', '', g.sigla)); nm.append(d); nm.title = gFull(g);
      const ib = el('td'); const bx = el('div', 'sv-inbar'); const tr2 = el('span'); const fl = el('i'); fl.style.width = (((g.indice ?? lo) - lo) / (5 - lo)) * 100 + '%'; fl.style.background = HB[Math.max(0, band(g.indice, 'media'))]; tr2.append(fl); bx.append(B(f2(g.indice), 'sv-num'), tr2); ib.append(bx);
      const tx = el('td', 'r sv-opt' + (g.taxa_resposta != null && g.taxa_resposta < 50 ? ' sv-bad' : ''), pct(g.taxa_resposta));
      const fw = el('td', 'sv-opt'); fw.textContent = g.item_mais_fraco ? `${qLabel(g.item_mais_fraco)} · ${loc(g.otimo_item_mais_fraco, 0)}%` : '—';
      tr.append(nm, el('td', 'sv-opt', g.area), el('td', 'r', fi(g.preenchidas)), tx, ib, el('td', 'r', pct(g.pct_otimo)), el('td', 'r sv-opt', g.ganho == null ? '—' : sgn(g.ganho, 2)), fw);
      tr.addEventListener('click', () => drillGroup(g));
      return tr;
    }));
    const hidden = all.length - all.filter((g) => g.preenchidas >= mN).length;
    $('rank-foot').textContent = t('rank_foot', { n: rows.length, u: t(lvl === 'turma' ? 'u_turmas' : lvl === 'area' ? 'u_area' : 'u_cursos') }) + (hidden ? t('rank_hidden', { n: hidden, m: mN }) : '');
    CSVD.rank = { header: [colName, 'Sigla', t('col_area'), t('col_fichas'), t('col_resp') + ' (%)', t('col_indice'), t('m_otimo'), t('col_ganho'), t('col_fraca')], rows: rows.map((g) => [gName(g), g.sigla, g.area, g.preenchidas, g.taxa_resposta, g.indice, g.pct_otimo, g.ganho, g.item_mais_fraco ? qLabel(g.item_mais_fraco) : '']) };
  }

  // ---------- Quality (whole base) ----------
  function drawQualidade() {
    const box = $('qual-cards'); box.classList.remove('dash-skeleton');
    const R = DB.rows, pre = R.filter((r) => r.pre), fal = R.filter((r) => r.status === 'Faltoso');
    const semNome = [...DB.cursos.values()].filter((c) => c.curso === 'Sem nome no cadastro').map((c) => c.sigla), semNomeSet = new Set(semNome);
    const semFicha = [...DB.cursos.values()].filter((c) => !(DB.preByCourse.get(c.sigla) > 0)).map((c) => c.sigla), semFichaSet = new Set(semFicha);
    const smallT = new Set([...DB.preByTurma].filter(([, n]) => n > 0 && n < 5).map(([k]) => k));
    const nT = [...DB.preByTurma.values()].filter((n) => n > 0).length;
    const comResp = pre.filter((r) => r.cnt > 0);
    const branco = pre.reduce((s, r) => s + (12 - r.nAns), 0);
    const parc = pre.filter((r) => r.nAns > 0 && r.nAns < 12);
    const pc = (a, b) => (b ? f1((a / b) * 100) + '%' : '—');
    const listShort = (a) => (a.length > 6 ? a.slice(0, 6).join(', ') + (Li() ? ` and ${a.length - 6} more` : ` e mais ${a.length - 6}`) : a.join(', ') || '—');
    const Q = [
      ['fichas', fi(R.length), { p: fi(pre.length), n: fi(R.filter((r) => r.status === 'Não preenchido').length), f: fi(fal.length) }, R],
      ['branco', fi(branco), { pct: pc(branco, pre.length * 12) }, pre.filter((r) => r.nAns < 12)],
      ['parciais', fi(parc.length), { pct: pc(parc.length, pre.length) }, parc],
      ['faltosos_resp', fi(fal.filter((r) => r.nAns > 0).length), {}, fal.filter((r) => r.nAns > 0)],
      ['sem_fichas', fi(semFicha.length), { lista: listShort(semFicha) }, R.filter((r) => semFichaSet.has(r.sigla))],
      ['sem_nome', fi(semNome.length), { x: fi(R.filter((r) => semNomeSet.has(r.sigla)).length), lista: listShort(semNome) }, R.filter((r) => semNomeSet.has(r.sigla))],
      ['turmas_pequenas', fi(smallT.size), { pct: pc(smallT.size, nT), b: fi(nT) }, pre.filter((r) => smallT.has(r.tk))],
      ['teto', pc(comResp.filter((r) => r.all5).length, comResp.length), {}, comResp.filter((r) => r.all5)],
    ];
    box.replaceChildren(...Q.map(([key, val, vars, rows]) => {
      const [label, tpl] = I.QUAL[key][Li()];
      let detail = tpl; Object.keys(vars).forEach((k) => { detail = detail.split('{' + k + '}').join(vars[k]); });
      const c = el('div', 'sv-qcard sv-clickable');
      const v = el('div', 'sv-qv', val);
      if (['faltosos_resp', 'sem_fichas', 'sem_nome'].includes(key) && val !== '0') v.classList.add('sv-bad');
      c.append(v, el('div', 'sv-ql', label), el('div', 'sv-qd', detail));
      c.addEventListener('click', () => openData({ label: () => I.QUAL[key][Li()][0], rows, hl: [] }));
      return c;
    }));
  }

  // ---------- Executive reading ----------
  function drawExec(S, G, filt, scopeSiglas, GR) {
    const en = Li() === 1;
    const li = (parts) => { const l = el('li'); para(l, parts); return l; };
    ['ex-fortes', 'ex-atencao', 'ex-acoes'].forEach((id) => $(id).classList.remove('dash-skeleton'));
    const its = S.items.filter((x) => x.n > 0);
    if (its.length < 2) {
      $('ex-fortes').replaceChildren(li([en ? 'No completed forms in this scope.' : 'Sem fichas preenchidas neste recorte.']));
      $('ex-atencao').replaceChildren(li(en ? ['Of ', B(fi(S.fichas)), ' forms on record, ', B(fi(S.nao_preenchidas)), ' were not completed.'] : ['Das ', B(fi(S.fichas)), ' fichas registradas, ', B(fi(S.nao_preenchidas)), ' não foram preenchidas.']));
      $('ex-acoes').replaceChildren(li([en ? 'Collect the pending forms before assessing this scope.' : 'Recolher as fichas pendentes antes de avaliar este recorte.']));
      return;
    }
    const byOt = [...its].sort((a, b) => b.pct5 - a.pct5);
    const fortes = [];
    fortes.push(li(en ? [B(qLabel(byOt[0].chave)), ' and ', B(qLabel(byOt[1].chave)), ' lead, with ', B(pct(byOt[0].pct5)), ' and ', B(pct(byOt[1].pct5)), ' "Excellent".'] : [B(qLabel(byOt[0].chave)), ' e ', B(qLabel(byOt[1].chave)), ' lideram, com ', B(pct(byOt[0].pct5)), ' e ', B(pct(byOt[1].pct5)), ' de "Ótimo".']));
    const dims = ['programa', 'organizacao', 'instrutor'].map((k) => ({ k, v: S['otimo_' + k] })).filter((d) => d.v != null).sort((a, b) => b.v - a.v);
    if (dims.length) { const d = dims[0]; fortes.push(li(en ? ['The best-rated dimension is ', B(dimName(d.k)), ' (', B(pct(d.v)), ' Excellent, mean ', B(f2(S['media_' + d.k])), ').'] : ['A dimensão mais bem avaliada é ', B(dimName(d.k)), ' (', B(pct(d.v)), ' Ótimo, média ', B(f2(S['media_' + d.k])), ').'])); }
    if (S.ganho != null) fortes.push(li(en ? ['Perceived learning: ', B(pct(S.pct_evoluiu)), ' reported improvement, with a mean gain of ', B(sgn(S.ganho, 2)), ' points on the 5-point scale.'] : ['Aprendizagem percebida: ', B(pct(S.pct_evoluiu)), ' declararam evolução, com ganho médio de ', B(sgn(S.ganho, 2)), ' ponto na escala de 5.']));
    if (filt && S.indice > G.indice + 0.05) fortes.push(li(en ? ['Index above the overall mean: ', B(f2(S.indice)), ' vs. ', B(f2(G.indice)), '.'] : ['Índice acima da média geral: ', B(f2(S.indice)), ' contra ', B(f2(G.indice)), '.']));
    $('ex-fortes').replaceChildren(...fortes);
    const at = [];
    const w = byOt[byOt.length - 1], w2 = byOt[byOt.length - 2];
    at.push(li(en ? [B(qLabel(w.chave)), ' is the question furthest from excellence: ', B(pct(w.pct5)), ' "Excellent" and ', B(pct(w.pct_ate_bom)), ' of scores "Good" or lower. Next comes ', B(qLabel(w2.chave)), ' (', B(pct(w2.pct5)), ').'] : [B(qLabel(w.chave)), ' é a pergunta mais distante da excelência: ', B(pct(w.pct5)), ' de "Ótimo" e ', B(pct(w.pct_ate_bom)), ' das notas em "Bom" ou abaixo. Logo atrás vem ', B(qLabel(w2.chave)), ' (', B(pct(w2.pct5)), ').']));
    const pol = [...its].sort((a, b) => (b.dp ?? 0) - (a.dp ?? 0))[0];
    if (pol && pol.dp != null && pol.dp >= 0.65) at.push(li(en ? ['Most divided opinions: ', B(qLabel(pol.chave)), ' (std. dev. ', B(f2(pol.dp)), ').'] : ['Opiniões mais divididas: ', B(qLabel(pol.chave)), ' (desvio ', B(f2(pol.dp)), ').']));
    if (S.taxa_resposta != null && S.taxa_resposta < 70) at.push(li(en ? ['Incomplete collection: only ', B(pct(S.taxa_resposta), 'sv-bad'), ' of expected forms came back completed (', B(fi(S.nao_preenchidas)), ' blank). Results may not represent the whole class.'] : ['Coleta incompleta: só ', B(pct(S.taxa_resposta), 'sv-bad'), ' das fichas esperadas voltaram preenchidas (', B(fi(S.nao_preenchidas)), ' em branco). Os resultados podem não representar a turma inteira.']));
    if (S.taxa_ausencia != null && S.taxa_ausencia >= 10) at.push(li(en ? ['Significant absence: ', B(pct(S.taxa_ausencia)), ' of forms belong to absent students (', B(fi(S.faltosos)), ').'] : ['Ausência relevante: ', B(pct(S.taxa_ausencia)), ' das fichas são de alunos faltosos (', B(fi(S.faltosos)), ').']));
    if (S.pct_nota_maxima != null && S.pct_nota_maxima >= 50) at.push(li(en ? ['Ceiling effect: ', B(pct(S.pct_nota_maxima)), ' of forms marked "Excellent" on everything. Track % Excellent and comments, not just the mean.'] : ['Efeito teto: ', B(pct(S.pct_nota_maxima)), ' das fichas marcaram "Ótimo" em tudo. Vale acompanhar % Ótimo e comentários, não só a média.']));
    const { lo } = lim(G.indice, G.dp_indice);
    const out = DB.courseGroups.filter((g) => scopeSiglas.has(g.sigla) && g.preenchidas > 0 && g.indice != null && g.indice < lo(g.preenchidas, 3.09));
    if (out.length && scopeSiglas.size > 1) at.push(li([String(out.length), en ? (out.length > 1 ? ' courses fall' : ' course falls') + ' below the 99.8% control limit: ' : (out.length > 1 ? ' cursos ficam' : ' curso fica') + ' abaixo do limite de controle de 99,8% no funil: ', ...out.slice(0, 4).flatMap((c, i) => [i ? ', ' : '', B(c.sigla), ' (', B(f2(c.indice)), ')']), out.length > 4 ? (en ? ' and others.' : ' e outros.') : '.']));
    $('ex-atencao').replaceChildren(...at);
    const ac = [];
    const cor = its.filter((x) => x.correlacao != null);
    if (cor.length >= 3) {
      const mx = d3.mean(cor, (c) => c.pct5), my = d3.mean(cor, (c) => c.correlacao);
      const pri = cor.filter((c) => c.pct5 < mx && c.correlacao > my).sort((a, b) => a.pct5 - b.pct5);
      if (pri.length) ac.push(li(en ? ['Prioritize ', ...pri.slice(0, 2).flatMap((c, i) => [i ? ' and ' : '', B(qLabel(c.chave))]), ': below the excellence average and among the questions that move most with overall perception (r = ', B(f2(pri[0].correlacao)), ').'] : ['Priorizar ', ...pri.slice(0, 2).flatMap((c, i) => [i ? ' e ' : '', B(qLabel(c.chave))]), ': ', pri.length > 1 ? 'estão' : 'está', ' abaixo da média de excelência e entre as que mais se movem junto com a percepção geral (r = ', B(f2(pri[0].correlacao)), ').']));
    }
    if (w.dimensao === 'programa') ac.push(li(en ? ['Review program design (', B(qLabel(w.chave)), '): more guided practice, exercises tied to the workstation, and material aligned with content.'] : ['Rever o desenho do programa (', B(qLabel(w.chave)), '): mais prática guiada, exercícios aplicados ao posto de trabalho e material alinhado ao conteúdo.']));
    else if (w.dimensao === 'organizacao') ac.push(li(en ? ['Tackle logistics (', B(qLabel(w.chave)), '): room and equipment checklist, and advance communication with classes.'] : ['Atacar a logística (', B(qLabel(w.chave)), '): checklist de sala, equipamentos e comunicação prévia com as turmas.']));
    else ac.push(li(en ? ['Support instructors on ', B(qLabel(w.chave)), ' with class observation and peer exchanges.'] : ['Apoiar os instrutores em ', B(qLabel(w.chave)), ' com observação de aula e trocas entre pares.']));
    const kids = GR.filter((c) => c.preenchidas + c.nao_preenchidas >= 20 && c.taxa_resposta != null).sort((a, b) => a.taxa_resposta - b.taxa_resposta);
    if (kids.length && kids[0].taxa_resposta < 60) ac.push(li([en ? 'Recover collection where it is lowest: ' : 'Recuperar a coleta onde ela é mais baixa: ', ...kids.slice(0, 3).flatMap((c, i) => [i ? ', ' : '', B(c.nivel === 'curso' ? c.sigla : gFull(c)), ' (', B(pct(c.taxa_resposta)), ')']), en ? '. Handing out the form at the end of the last session, before people leave, usually raises the rate.' : '. Aplicar a ficha ao fim da última aula, antes da saída, costuma elevar a taxa.']));
    if (S.pct_nota_maxima >= 50) ac.push(li([en ? 'Add a mandatory open question to the form ("what would you change?") to capture improvements the 1–5 scale does not show.' : 'Incluir na ficha uma pergunta aberta obrigatória ("o que mudaria?") para captar melhorias que a escala de 1 a 5 não mostra.']));
    $('ex-acoes').replaceChildren(...ac);
  }
  $('btn-copy').addEventListener('click', async () => {
    const sec = (id, h) => h + '\n' + [...$(id).querySelectorAll('li')].map((l) => '• ' + l.textContent.trim()).join('\n');
    const txt = [scopeLabel(), $('sv-take').textContent.trim(), '', sec('ex-fortes', t('ex_fortes')), '', sec('ex-atencao', t('ex_atencao')), '', sec('ex-acoes', t('ex_acoes'))].join('\n');
    let ok = false;
    try { await navigator.clipboard.writeText(txt); ok = true; } catch (e) {
      try { const ta = el('textarea'); ta.value = txt; ta.style.position = 'absolute'; ta.style.left = '-9999px'; root.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove(); } catch (e2) { ok = false; }
    }
    toast(ok ? t('copied') : t('failed'));
  });

  // ---------- CSV ----------
  const csvString = (header, rows) => {
    const sep = Li() ? ',' : ';';
    const cell = (v) => { if (v == null) return ''; let s = typeof v === 'number' ? (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100)) : String(v); if (typeof v === 'number' && !Li()) s = s.replace('.', ','); if (/[";,\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"'; return s; };
    return '﻿' + [header, ...rows].map((r) => r.map(cell).join(sep)).join('\r\n');
  };
  const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60);
  const scopeSlug = () => slug(scopeLabel());
  $('btn-csv').addEventListener('click', () => {
    if (!SCOPE) return;
    const stx = STX();
    const keys = QK.concat(['conhec_antes', 'conhec_apos']);
    const header = ['Sigla', t('col_curso'), t('col_area'), t('col_turma'), t('col_ficha'), t('col_status'), ...keys.map(qLabel)];
    const out = SCOPE.rows.map((r) => [r.sigla, cname(r.sigla), r.area, r.turma, r.rel, stx[r.status] || r.status, ...r.v, r.ka, r.kd]);
    deliver(new Blob([csvString(header, out)], { type: 'text/csv' }), `fichas_${scopeSlug()}.csv`, $('cabecalho'), false);
  });

  // ---------- Export menu (PNG / PDF / CSV) ----------
  function buildExp(host) {
    host.replaceChildren();
    const b = el('button', 'sv-btn'); b.type = 'button';
    b.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5v8m0 0L5 7.5m3 3l3-3M3 13.5h10"/></svg>';
    const lbl = el('span', '', t('exp')); b.append(lbl);
    const menu = el('div', 'sv-exp-menu'); menu.hidden = true;
    const node = () => document.getElementById(host.dataset.export);
    const item = (txt, fn) => { const it = el('button', '', txt); it.type = 'button'; it.addEventListener('click', async () => { menu.hidden = true; lbl.textContent = t('gen'); b.disabled = true; try { await fn(); lbl.textContent = t('exp'); } catch (e) { lbl.textContent = t('failed'); setTimeout(() => { lbl.textContent = t('exp'); }, 2500); } finally { b.disabled = false; } }); menu.append(it); };
    item(t('exp_png'), async () => { const c = await renderCanvas(node(), 3); const blob = await new Promise((res, rej) => c.toBlob((x) => (x ? res(x) : rej(new Error('PNG'))), 'image/png')); await deliver(blob, `${host.dataset.name}_${scopeSlug()}.png`, node(), true); });
    item(t('exp_pdf'), async () => { await exportPDF([node()], `${host.dataset.name}_${scopeSlug()}.pdf`, node()); });
    if (host.dataset.csv) item(t('exp_csv'), async () => { const d = CSVD[host.dataset.csv]; if (!d) throw new Error('no data'); await deliver(new Blob([csvString(d.header, d.rows)], { type: 'text/csv' }), `${host.dataset.name}_${scopeSlug()}.csv`, node(), false); });
    b.addEventListener('click', (e) => { e.stopPropagation(); const was = menu.hidden; document.querySelectorAll('.sv-exp-menu').forEach((m) => { m.hidden = true; }); menu.hidden = !was; });
    host.append(b, menu);
  }

  // ---------- Rendering to image ----------
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
    else if (html && cs.display !== 'inline' && cs.display !== 'none') { s += 'width:' + cs.width + ';'; if (!src.textContent.trim()) s += 'height:' + cs.height + ';'; }
    if (html && (tag === 'button' || tag === 'select' || tag === 'input')) for (const q in NON) s += q + ':' + cs.getPropertyValue(q) + ';';
    s += 'animation:none;transition:none;';
    dst.setAttribute('style', s);
    return cs;
  }
  function walk(src, dst, parentCS) { const cs = inline(src, dst, parentCS); const sc = src.children, dc = dst.children; for (let i = 0; i < sc.length; i++) walk(sc[i], dc[i], cs); }
  async function renderCanvas(node, maxScale) {
    const W = Math.ceil(node.getBoundingClientRect().width);
    const pad = 28;
    const clone = node.cloneNode(true);
    walk(node, clone, null);
    clone.querySelectorAll('.sv-tools, .sv-exp, .sv-tip, .sv-preview, .sv-i, input, details, .sv-actions').forEach((e) => e.remove());
    clone.querySelectorAll('.sv-scroll').forEach((e) => { e.style.maxHeight = 'none'; e.style.height = 'auto'; e.style.overflow = 'visible'; let p = e.parentElement; while (p) { p.style.height = 'auto'; p.style.maxHeight = 'none'; p = p.parentElement; } });
    clone.querySelectorAll('th').forEach((e) => { e.style.position = 'static'; });
    clone.style.width = W + 'px'; clone.style.height = 'auto'; clone.style.margin = '0';
    const rcs = getComputedStyle(node);
    const probe = el('div'); probe.style.color = 'var(--color-bg)'; root.appendChild(probe); const bg = getComputedStyle(probe).color; probe.style.color = 'var(--color-fg-muted)'; const muted = getComputedStyle(probe).color; probe.remove();
    const wrap = document.createElement('div');
    let vars = ''; const scs = getComputedStyle(root);
    for (let i = 0; i < scs.length; i++) { const p = scs[i]; if (p.startsWith('--')) vars += p + ':' + scs.getPropertyValue(p) + ';'; }
    wrap.setAttribute('style', vars + `box-sizing:border-box;width:${W + pad * 2}px;padding:${pad}px;background:${bg};font-family:${rcs.fontFamily};color:${rcs.color};`);
    wrap.appendChild(clone);
    const foot = document.createElement('div');
    foot.textContent = `${t('title')} · ${scopeLabel()} · ${t('generated', { d: new Date().toLocaleDateString(LOC()) })}`;
    foot.setAttribute('style', `margin-top:14px;font-size:11px;color:${muted};font-family:${rcs.fontFamily};`);
    wrap.appendChild(foot);
    const host = document.createElement('div');
    host.setAttribute('style', 'position:absolute;left:-200000px;top:0;width:' + (W + pad * 2) + 'px;');
    root.appendChild(host); host.appendChild(wrap);
    const Ht = Math.ceil(wrap.getBoundingClientRect().height) + 14, Wt = W + pad * 2;
    host.remove();
    const scale = Math.max(1, Math.min(maxScale, Math.sqrt(140e6 / (Wt * Ht))));
    const xml = new XMLSerializer().serializeToString(wrap);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(Wt * scale)}" height="${Math.round(Ht * scale)}" viewBox="0 0 ${Wt} ${Ht}"><foreignObject x="0" y="0" width="${Wt}" height="${Ht}">${xml}</foreignObject></svg>`;
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    const c = document.createElement('canvas'); c.width = Math.round(Wt * scale); c.height = Math.round(Ht * scale);
    const ctx = c.getContext('2d'); ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
    c.svBg = bg; c.svScale = scale;
    return c;
  }
  // ---------- PDF ----------
  const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  const ensurePDF = () => new Promise((res) => {
    if (window.jspdf) return res(true);
    const emb = document.getElementById('lib-jspdf');
    if (emb) { const s = document.createElement('script'); s.textContent = emb.textContent; document.head.appendChild(s); return res(!!window.jspdf); }
    if (!STANDALONE) return res(false);
    const s = document.createElement('script'); s.src = JSPDF_URL; s.onload = () => res(!!window.jspdf); s.onerror = () => res(false); document.head.appendChild(s);
  });
  function printNodes(nodes) {
    root.classList.add('sv-printing'); nodes.forEach((n) => n.classList.add('sv-print-target'));
    const done = () => { root.classList.remove('sv-printing'); nodes.forEach((n) => n.classList.remove('sv-print-target')); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    try { window.print(); } catch (e) { /* unavailable */ }
    setTimeout(done, 3000);
  }
  async function exportPDF(nodes, fname, anchor) {
    const ok = await ensurePDF();
    if (!ok) { if (nodes.length === 1) printNodes(nodes); else { setView('painel'); try { window.print(); } catch (e) { /* unavailable */ } } return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4', compress: true });
    const PW = doc.internal.pageSize.getWidth(), PH = doc.internal.pageSize.getHeight(), M = 24, HEAD = 22;
    let y = M + HEAD, used = false;
    const header = () => { doc.setFontSize(9); doc.setTextColor(110); doc.text(`${t('title')} · ${scopeLabel()} · ${t('generated', { d: new Date().toLocaleDateString(LOC()) })}`, M, M + 8); };
    header();
    for (const node of nodes) {
      if (!node) continue;
      const c = await renderCanvas(node, 2);
      const w = Math.min(PW - 2 * M, (c.width / c.svScale) * 0.75), scale = w / c.width;
      const fullH = c.height * scale, pageH = PH - M - (M + HEAD);
      if (used && fullH <= pageH && fullH > PH - M - y) { doc.addPage(); header(); y = M + HEAD; used = false; }
      let sy = 0;
      while (sy < c.height) {
        const room = PH - M - y;
        if (used && room < Math.min(140, (c.height - sy) * scale)) { doc.addPage(); header(); y = M + HEAD; used = false; continue; }
        const sliceH = Math.min(c.height - sy, Math.floor(room / scale));
        const part = document.createElement('canvas'); part.width = c.width; part.height = sliceH;
        const pctx = part.getContext('2d'); pctx.fillStyle = c.svBg; pctx.fillRect(0, 0, part.width, part.height); pctx.drawImage(c, 0, sy, c.width, sliceH, 0, 0, c.width, sliceH);
        doc.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', M, y, w, sliceH * scale, undefined, 'FAST');
        y += sliceH * scale + 8; sy += sliceH; used = true;
        if (sy < c.height) { doc.addPage(); header(); y = M + HEAD; used = false; }
      }
    }
    const n = doc.getNumberOfPages();
    for (let p = 1; p <= n; p++) { doc.setPage(p); doc.setFontSize(8); doc.setTextColor(130); doc.text(t('pdf_page', { p, n }), PW - M, PH - 10, { align: 'right' }); }
    await deliver(doc.output('blob'), fname, anchor, false);
  }
  $('btn-pdf-all').addEventListener('click', async () => {
    const b = $('btn-pdf-all'), lbl = b.querySelector('span'); const old = lbl.textContent;
    lbl.textContent = t('pdf_making'); b.disabled = true;
    const wasDados = UI.view === 'dados'; if (wasDados) setView('painel');
    try { await exportPDF(['cabecalho', 'kpis', 'card-itens', 'card-dims', 'card-radar', 'card-conhecimento', 'card-prioridade', 'card-funil', 'card-turmas', 'card-heat', 'card-ranking', 'card-participacao', 'card-qualidade', 'exec'].map((id) => $(id)), `relatorio_${scopeSlug()}.pdf`, $('cabecalho')); }
    catch (e) { toast(t('failed')); }
    finally { lbl.textContent = old; b.disabled = false; if (wasDados) setView('dados'); }
  });
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
    if (node && node.classList.contains('sv-card')) { const head = node.querySelector('.sv-card-head'); if (head) head.after(box); else node.prepend(box); } else if (node) node.before(box); else root.prepend(box);
    try { a.click(); } catch (e) { /* preview stays */ }
  }
  async function deliver(blob, fname, node, isImg) {
    if (DL === undefined) await Promise.race([dlReady, new Promise((r) => setTimeout(r, 1500))]);
    if (DL) { try { await DL.save({ filename: fname, data: blob }); return; } catch (e) { if (e && (e.code === 'declined' || e.code === 'rate_limited')) return; } }
    if (STANDALONE) { const u = URL.createObjectURL(blob); const lk = document.createElement('a'); lk.href = u; lk.download = fname; document.body.appendChild(lk); lk.click(); lk.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); return; }
    preview(blob, fname, node, isImg);
  }

  // ---------- main ----------
  applyColors();
  applyI18n();
  buildCfgPanel();
  setView('painel');
  drawDados();
  let lastLang = null;
  dash.onData(() => {
    applyColors();
    if (lastLang !== UI.lang) { applyI18n(); lastLang = UI.lang; }
    const dR = dash.data('relatorios'), dC = dash.data('cursos');
    const ok = (d) => d.status === 'ok' && Array.isArray(d.data) && d.data.length;
    if (!(ok(dR) && ok(dC))) return;
    const prevDB = DB;
    buildDB(dR.data, dC.data);
    if (prevDB && prevDB !== DB) { D = null; }
    const rows = scopeRows();
    const S = agg(rows), G = DB.G, filt = isFiltered();
    const lvl = level();
    const GR = groups(rows, lvl, F().onlyFilled);
    const scopeSiglas = new Set(rows.map((r) => r.sigla));
    SCOPE = { rows, S };
    $('sv-eyebrow-n').textContent = t('counts', { c: DB.cursos.size, a: new Set([...DB.cursos.values()].map((c) => c.area)).size, t: fi(DB.preByTurma.size) });
    $('sv-scope').replaceChildren(el('b', '', scopeLabel()), document.createTextNode(t('filled_forms', { n: fi(S.preenchidas) })));
    drawFilters();
    drawKpis(S, G, filt);
    drawTake(S, filt);
    drawItens(S, G, filt, rows);
    drawDims(S, G, filt, rows);
    drawRadar(S, G, filt, rows);
    drawConh(S, rows);
    drawPrioridade(S, rows);
    drawFunil(G, scopeSiglas, filt);
    drawTurmas(rows);
    drawHeat(GR, G, lvl);
    drawRanking(GR, lvl);
    drawParticipacao(GR, lvl);
    drawQualidade();
    drawExec(S, G, filt, scopeSiglas, GR);
    paintPreview();
    drawDados();
    firstDraw = false;
  });
})();
