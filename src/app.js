(() => {
  const root = document.querySelector('.sv');
  root.style.setProperty('--sv-accent', dash.colors[0]);
  const $ = (id) => document.getElementById(id);
  const NV = ['var(--sv-n1)', 'var(--sv-n2)', 'var(--sv-n3)', 'var(--sv-n4)', 'var(--sv-n5)'];
  const NOTAS = ['Fraco', 'Regular', 'Bom', 'Muito bom', 'Ótimo'];
  const DIMS = [['Programa e metodologia', 'programa'], ['Organização', 'organizacao'], ['Instrutor', 'instrutor']];
  const CURTO = { objetivos: 'Objetivos', teoria_pratica: 'Teoria e prática', material: 'Material', pontualidade: 'Pontuali­dade', instalacoes: 'Instala­ções', apoio_adm: 'Apoio adm.', audiovisuais: 'Audio­visuais', dominio: 'Domínio', clareza: 'Clareza', duvidas: 'Dúvidas' };
  const loc = (v, d) => (v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const f1 = (v) => loc(v, 1), f2 = (v) => loc(v, 2), fi = (v) => (v == null ? '—' : Number(v).toLocaleString('pt-BR'));
  const pct = (v) => (v == null ? '—' : f1(v) + '%');
  const sgn = (v, d = 2, suf = '') => (v == null || !isFinite(v) ? '' : (v > 0 ? '+' : v < 0 ? '−' : '±') + loc(Math.abs(v), d) + suf);
  const enc = (s) => encodeURIComponent(s);
  const P = () => dash.params();
  let firstDraw = true;

  // ---------- small DOM helpers ----------
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const mk = (text, field, esc, cls, src = 'escopos', key = 'escopo') => { const b = el('b', cls, text); b.dataset.source = src; b.dataset.field = field; b.dataset.where = key + '=' + enc(esc); return b; };
  const para = (node, parts) => node.replaceChildren(...parts.flat().filter((p) => p != null && p !== '').map((p) => (typeof p === 'string' ? document.createTextNode(p) : p)));
  const fail = (node) => { node.classList.remove('dash-skeleton'); node.replaceChildren(el('div', 'sv-fail', 'Failed to load')); };
  const empty = (node, msg) => { node.querySelectorAll(':scope > svg').forEach((s) => s.remove()); let e = node.querySelector(':scope > .sv-empty'); if (!e) { e = el('div', 'sv-empty'); node.prepend(e); } e.textContent = msg; };
  const clearChart = (node) => { node.querySelectorAll(':scope > svg, :scope > .sv-empty').forEach((s) => s.remove()); };
  const tipFor = (box) => { let t = box.querySelector(':scope > .sv-tip'); if (!t) { t = el('div', 'sv-tip'); box.appendChild(t); } return t; };
  const showTip = (box, tip, ev, head, lines) => {
    tip.replaceChildren(el('div', 'sv-tip-h', head));
    lines.forEach((l) => { const d = el('div'); if (Array.isArray(l)) { const sw = el('i'); sw.style.background = l[0]; d.append(sw, l[1]); } else d.textContent = l; tip.appendChild(d); });
    const r = box.getBoundingClientRect();
    tip.style.opacity = 1;
    let x = ev.clientX - r.left + 14, y = ev.clientY - r.top + 14;
    if (x + tip.offsetWidth > r.width) x = Math.max(0, ev.clientX - r.left - tip.offsetWidth - 14);
    if (y + tip.offsetHeight > r.height + 40) y = Math.max(0, ev.clientY - r.top - tip.offsetHeight - 10);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  };
  const hideTip = (tip) => { tip.style.opacity = 0; };
  const styleAxis = (a) => { a.attr('font-size', null).attr('font-family', null); a.selectAll('text').style('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)'); a.selectAll('line,path').style('stroke', 'var(--cds-chart-axis)'); };
  const textW = (svg, txt, size) => { const t = svg.append('text').style('font-size', size).text(txt); const w = t.node().getComputedTextLength(); t.remove(); return w; };

  // ---------- data indexes ----------
  let IDX = null;
  function indexes(E, I, K, C) {
    if (IDX && IDX.src[0] === E && IDX.src[1] === I && IDX.src[2] === K && IDX.src[3] === C) return IDX;
    const e = new Map(E.map((r) => [r.escopo, r]));
    const kids = new Map();
    E.forEach((r) => { if (!r.pai) return; if (!kids.has(r.pai)) kids.set(r.pai, []); kids.get(r.pai).push(r); });
    const i = new Map(); I.forEach((r) => { if (!i.has(r.escopo)) i.set(r.escopo, []); i.get(r.escopo).push(r); });
    i.forEach((a) => a.sort((x, y) => x.ordem - y.ordem));
    const k = new Map(); K.forEach((r) => { if (!k.has(r.escopo)) k.set(r.escopo, []); k.get(r.escopo).push(r); });
    const cursosMap = new Map(C.map((c) => [c.sigla, c]));
    IDX = { src: [E, I, K, C], e, kids, i, k, cursos: C, cursosMap };
    return IDX;
  }

  // ---------- scope ----------
  function escopoAtual(X) {
    const p = P();
    if (p.curso && p.turma != null && p.turma !== '' && X.e.has('T:' + p.curso + ':' + p.turma)) return 'T:' + p.curso + ':' + p.turma;
    if (p.curso && X.e.has('C:' + p.curso)) return 'C:' + p.curso;
    if (p.area && X.e.has('A:' + p.area)) return 'A:' + p.area;
    return 'geral';
  }
  const rotuloEscopo = (X, esc) => {
    const r = X.e.get(esc);
    if (!r) return 'Todos os cursos';
    if (r.nivel === 'curso') return r.sigla + ' · ' + r.rotulo;
    if (r.nivel === 'turma') return r.sigla + ' · ' + r.rotulo;
    return r.rotulo;
  };
  // children used by comparisons: courses (geral/area) or turmas (curso/turma)
  function compRows(X, esc) {
    const r = X.e.get(esc);
    if (r.nivel === 'geral') return [...X.e.values()].filter((x) => x.nivel === 'curso');
    if (r.nivel === 'area') return X.kids.get(esc) || [];
    if (r.nivel === 'curso') return X.kids.get(esc) || [];
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

  // ---------- filters ----------
  const fArea = $('f-area'), fCurso = $('f-curso'), fTurma = $('f-turma'), fMin = $('f-min');
  fArea.addEventListener('change', () => dash.setParams({ area: fArea.value || null, curso: null, turma: null }));
  fCurso.addEventListener('change', () => {
    const v = fCurso.value || null;
    const c = v && IDX ? IDX.cursosMap.get(v) : null;
    dash.setParams({ curso: v, turma: null, area: c ? c.area : P().area ?? null });
  });
  fTurma.addEventListener('change', () => dash.setParams({ turma: fTurma.value === '' ? null : Number(fTurma.value) }));
  fMin.addEventListener('change', () => dash.setParams({ minN: Number(fMin.value) }));
  $('f-reset').addEventListener('click', () => dash.resetParams());
  document.querySelectorAll('[data-ordem]').forEach((b) => b.addEventListener('click', () => dash.setParams({ ordem: b.dataset.ordem })));
  document.querySelectorAll('[data-metrica]').forEach((b) => b.addEventListener('click', () => dash.setParams({ metrica: b.dataset.metrica })));

  function drawFilters(X, esc) {
    const p = P();
    const areas = d3.rollups(X.cursos, (v) => v.length, (c) => c.area).sort((a, b) => d3.ascending(a[0], b[0]));
    fArea.replaceChildren(new Option('Todas as áreas', ''), ...areas.map(([a, n]) => new Option(`${a} · ${n} curso${n > 1 ? 's' : ''}`, a)));
    fArea.value = p.area ?? '';
    const cs = X.cursos.filter((c) => !p.area || c.area === p.area).slice().sort((a, b) => d3.ascending(a.sigla, b.sigla));
    fCurso.replaceChildren(new Option(p.area ? 'Todos os cursos da área' : 'Todos os cursos', ''), ...cs.map((c) => new Option(`${c.sigla} · ${c.curso}`, c.sigla)));
    fCurso.value = p.curso ?? '';
    const ts = p.curso ? (X.kids.get('C:' + p.curso) || []).slice().sort((a, b) => a.turma - b.turma) : [];
    fTurma.replaceChildren(new Option(p.curso ? 'Todas as turmas' : '—', ''), ...ts.map((t) => new Option(`Turma ${t.turma} · ${t.preenchidas} ficha${t.preenchidas === 1 ? '' : 's'}`, String(t.turma))));
    fTurma.disabled = !p.curso;
    fTurma.value = p.turma != null && p.curso ? String(p.turma) : '';
    fMin.value = String(p.minN ?? 5);
    document.querySelectorAll('[data-ordem]').forEach((b) => b.setAttribute('aria-pressed', String((p.ordem || 'form') === b.dataset.ordem)));
    document.querySelectorAll('[data-metrica]').forEach((b) => b.setAttribute('aria-pressed', String((p.metrica || 'media') === b.dataset.metrica)));
    const r = X.e.get(esc);
    const sc = $('sv-scope');
    sc.replaceChildren(el('b', '', rotuloEscopo(X, esc)), document.createTextNode(fi(r.preenchidas) + ' fichas preenchidas'));
  }

  // ---------- KPIs ----------
  function deltaLine(node, v, ref, d, suf, goodUp = true, unit = '') {
    if (ref == null || v == null) { node.textContent = ''; return; }
    const diff = v - ref;
    const good = goodUp ? diff > 0 : diff < 0;
    node.replaceChildren();
    const s = el('span', Math.abs(diff) < Math.pow(10, -d) ? '' : good ? 'sv-good' : 'sv-bad', (diff > 0 ? '▲ ' : diff < 0 ? '▼ ' : '') + sgn(diff, d, unit));
    node.append(s, document.createTextNode(' vs. todos os cursos (' + loc(ref, d) + suf + ')'));
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
    deltaLine($('d-otimo'), r.pct_otimo, isG ? null : g.pct_otimo, 1, '%', true, ' p.p.');
    $('k-atebom').textContent = f1(r.pct_ate_bom);
    $('k-max').textContent = f1(r.pct_nota_maxima);
    const mb = $('k-max-bar'); const pp = el('div', 'sv-pip'); const fill = el('i'); fill.style.width = (r.pct_nota_maxima ?? 0) + '%'; pp.appendChild(fill); mb.replaceChildren(pp);
    deltaLine($('d-max'), r.pct_nota_maxima, isG ? null : g.pct_nota_maxima, 1, '%', true, ' p.p.');
    $('k-taxa').textContent = f1(r.taxa_resposta);
    $('k-taxa').classList.toggle('sv-bad', r.taxa_resposta != null && r.taxa_resposta < 50);
    deltaLine($('d-taxa'), r.taxa_resposta, isG ? null : g.taxa_resposta, 1, '%', true, ' p.p.');
    $('k-pre').textContent = fi(r.preenchidas);
    $('k-esperadas').textContent = fi(r.preenchidas + r.nao_preenchidas);
    $('k-fal').textContent = fi(r.faltosos);
    const ring = d3.select('#k-ring'); ring.selectAll('*').remove();
    const arc = d3.arc().innerRadius(20).outerRadius(26).cornerRadius(3);
    const gg = ring.append('g').attr('transform', 'translate(27,27)');
    gg.append('path').attr('d', arc({ startAngle: 0, endAngle: 2 * Math.PI })).style('fill', 'var(--sv-n3)');
    gg.append('path').attr('d', arc({ startAngle: 0, endAngle: 2 * Math.PI * (r.taxa_resposta ?? 0) / 100 })).style('fill', r.taxa_resposta < 50 ? 'var(--color-bad)' : 'var(--sv-accent)');
    $('k-ganho').textContent = r.ganho == null ? '—' : sgn(r.ganho, 2);
    $('k-antes').textContent = f2(r.conhec_antes); $('k-apos').textContent = f2(r.conhec_apos);
    $('k-evol').textContent = f1(r.pct_evoluiu);
    $('kn-antes').textContent = f2(r.conhec_antes); $('kn-apos').textContent = f2(r.conhec_apos);
    $('kn-ev').textContent = pct(r.pct_evoluiu); $('kn-ig').textContent = pct(r.pct_igual); $('kn-rg').textContent = pct(r.pct_regrediu);
  }

  // ---------- Takeaway ----------
  function drawTake(X, esc) {
    const r = X.e.get(esc), its = (X.i.get(esc) || []).filter((x) => x.n > 0);
    const node = $('sv-take'); node.classList.remove('dash-skeleton');
    if (!r.preenchidas) { para(node, [rotuloEscopo(X, esc), ' não tem fichas preenchidas: das ', mk(fi(r.fichas), 'fichas', esc), ' fichas registradas, ', mk(fi(r.nao_preenchidas), 'nao_preenchidas', esc), ' não foram preenchidas e ', mk(fi(r.faltosos), 'faltosos', esc), ' são de alunos faltosos.']); return; }
    const best = [...its].sort((a, b) => b.pct5 - a.pct5)[0], worst = [...its].sort((a, b) => a.pct5 - b.pct5)[0];
    const wi = (it) => 'escopo=' + enc(esc) + '&chave=' + enc(it.chave);
    const mi = (text, field, it, cls) => { const b = el('b', cls, text); b.dataset.source = 'itens'; b.dataset.field = field; b.dataset.where = wi(it); return b; };
    const parts = [
      esc === 'geral' ? 'Satisfação alta e consistente: ' : rotuloEscopo(X, esc) + ': ',
      'índice de ', mk(f2(r.indice), 'indice', esc), ' em 5, com ', mk(pct(r.pct_otimo), 'pct_otimo', esc, 'sv-good'), ' das respostas em "Ótimo". ',
    ];
    if (best && worst && best !== worst) parts.push('O ponto mais forte é ', mi(best.item, 'item', best), ' (', mi(pct(best.pct5), 'pct5', best), ' Ótimo); o mais distante da excelência é ', mi(worst.item, 'item', worst, 'sv-bad'), ' (', mi(pct(worst.pct5), 'pct5', worst), '). ');
    if (r.conhec_antes != null) parts.push('O conhecimento declarado sobe de ', mk(f2(r.conhec_antes), 'conhec_antes', esc), ' para ', mk(f2(r.conhec_apos), 'conhec_apos', esc), '. ');
    if (r.taxa_resposta != null && r.taxa_resposta < 70) parts.push('O maior risco está na coleta: só ', mk(pct(r.taxa_resposta), 'taxa_resposta', esc, 'sv-bad'), ' das fichas esperadas voltaram preenchidas.');
    para(node, parts);
  }

  // ---------- Items: distance to excellence ----------
  function drawItens(X, esc) {
    const box = $('chart-itens'); box.classList.remove('dash-skeleton'); clearChart(box);
    const tip = tipFor(box);
    const rows = (X.i.get(esc) || []).filter((r) => r.n > 0);
    const lg = $('lg-itens');
    const ref = esc !== 'geral' ? new Map((X.i.get('geral') || []).map((r) => [r.chave, r])) : null;
    lg.replaceChildren(...[4, 3, 2, 1, 0].map((i) => { const s = el('span'); const sw = el('i'); sw.style.background = NV[i]; s.append(sw, `${i + 1} · ${NOTAS[i]}`); return s; }));
    if (ref) { const s = el('span'); s.append(el('i', 'sv-lg-line'), 'Referência: todos os cursos'); lg.appendChild(s); }
    if (!rows.length) { empty(box, 'Sem respostas neste recorte.'); return; }
    const W = box.clientWidth; if (!W) return;
    const narrow = W < 620;
    const ordem = P().ordem || 'form';
    const r0 = X.e.get(esc);
    let list = [];
    if (ordem === 'rank') list = [...rows].sort((a, b) => b.pct5 - a.pct5 || b.media - a.media).map((r) => ({ t: 'row', r }));
    else { let dim = null; rows.forEach((r) => { if (r.dimensao !== dim) { dim = r.dimensao; list.push({ t: 'head', dim }); } list.push({ t: 'row', r }); }); }
    const svg = d3.select(box).insert('svg', '.sv-tip').attr('width', '100%');
    const labW = narrow ? 0 : d3.max(rows, (r) => textW(svg, r.item, 'var(--cds-font-size-body)')) + 22;
    const statW = narrow ? 50 : 84;
    const L = Math.max(12, d3.max(rows, (r) => 100 - r.pct5));
    const R = Math.max(d3.max(rows, (r) => r.pct5), ref ? d3.max(rows, (r) => ref.get(r.chave)?.pct5 ?? 0) : 0);
    const x = d3.scaleLinear([-L, R], [labW + 46, W - statW - 50]);
    const rowH = narrow ? 52 : 36, headH = 34, top = 26, barH = 20;
    let y = top; list.forEach((d) => { d.y = y; y += d.t === 'head' ? headH : rowH; });
    const H = y + 6;
    svg.attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const cap = (t, xx, anchor) => svg.append('text').attr('x', xx).attr('y', 12).attr('text-anchor', anchor).style('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)').text(t);
    cap('← demais notas', x(-L), 'start'); cap('Ótimo →', x(R), 'end'); cap('média', W, 'end');
    svg.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', top - 6).attr('y2', H - 4).style('stroke', 'var(--cds-chart-reference)').attr('stroke-dasharray', '3 3');
    const dimField = { 'Programa e metodologia': 'programa', 'Organização': 'organizacao', 'Instrutor': 'instrutor' };
    list.forEach((d, idx) => {
      const g = svg.append('g').attr('transform', `translate(0,${d.y})`).attr('class', firstDraw ? 'sv-fade' : null).style('animation-delay', idx * 25 + 'ms');
      if (d.t === 'head') {
        g.append('text').attr('x', 0).attr('y', 22).style('font-size', '11px').style('letter-spacing', '.08em').style('text-transform', 'uppercase').style('fill', 'var(--color-fg-muted)').style('font-weight', 'var(--cds-font-weight-medium)').text(d.dim);
        const k = dimField[d.dim];
        g.append('text').attr('x', W).attr('y', 22).attr('text-anchor', 'end').style('font-size', 'var(--cds-font-size-caption)').style('fill', 'var(--color-fg-muted)').text(`média ${f2(r0['media_' + k])} · ${pct(r0['otimo_' + k])} Ótimo`);
        g.append('line').attr('x1', 0).attr('x2', W).attr('y1', 28).attr('y2', 28).style('stroke', 'var(--cds-chart-grid)');
        return;
      }
      const r = d.r, by = narrow ? 24 : (rowH - barH) / 2;
      const ly = narrow ? 14 : by + barH / 2 + 5;
      g.append('text').attr('x', 0).attr('y', ly).style('font-size', 'var(--cds-font-size-body)').style('fill', 'var(--color-fg)').text(r.item + (ordem === 'rank' && !narrow ? '' : ''));
      let cum = 0; const segs = [];
      [4, 3, 2, 1].forEach((k) => { const v = r['pct' + k] || 0; segs.push({ k, x0: -(cum + v), x1: -cum, v }); cum += v; });
      segs.push({ k: 5, x0: 0, x1: r.pct5, v: r.pct5 });
      g.selectAll('rect').data(segs.filter((s) => s.v > 0)).join('rect')
        .attr('x', (s) => x(s.x0) + (s.k === 5 ? 1 : 0.5)).attr('width', (s) => Math.max(1, x(s.x1) - x(s.x0) - 1)).attr('y', by).attr('height', barH).attr('rx', 3)
        .style('fill', (s) => NV[s.k - 1])
        .on('mousemove', (ev) => showTip(box, tip, ev, `${r.item} · ${fi(r.n)} respostas`, [5, 4, 3, 2, 1].map((k) => [NV[k - 1], `${k} ${NOTAS[k - 1]}: ${pct(r['pct' + k])}`]).concat(ref ? [`Todos os cursos: ${pct(ref.get(r.chave)?.pct5)} Ótimo`] : [])))
        .on('mouseleave', () => hideTip(tip));
      g.append('text').attr('x', x(-(100 - r.pct5)) - 6).attr('y', by + barH / 2 + 4).attr('text-anchor', 'end').style('font-size', 'var(--cds-font-size-caption)').style('fill', 'var(--color-fg-muted)').text(pct(100 - r.pct5));
      let endX = x(r.pct5);
      if (ref && ref.get(r.chave)) {
        const rx = x(ref.get(r.chave).pct5);
        g.append('line').attr('x1', rx).attr('x2', rx).attr('y1', by - 4).attr('y2', by + barH + 4).style('stroke', 'var(--color-fg)').style('stroke-width', 2);
        endX = Math.max(endX, rx);
      }
      g.append('text').attr('x', endX + 7).attr('y', by + barH / 2 + 4).style('font-size', 'var(--cds-font-size-caption)').style('fill', 'var(--color-fg)').style('font-weight', 'var(--cds-font-weight-medium)').text(pct(r.pct5));
      g.append('text').attr('x', W).attr('y', by + barH / 2 + 6).attr('text-anchor', 'end').style('font-family', 'var(--font-anthropic-serif)').style('font-size', '1.15rem').style('fill', 'var(--color-fg)').text(f2(r.media));
    });
    $('itens-note').textContent = `Percentual de respostas por nota em cada pergunta · ${fi(r0.preenchidas)} fichas preenchidas.`;
  }

  // ---------- Dimensions ----------
  function drawDims(X, esc) {
    const box = $('dims'); box.classList.remove('dash-skeleton');
    const r = X.e.get(esc), g = X.e.get('geral');
    box.replaceChildren(...DIMS.map(([nome, k]) => {
      const w = el('div', firstDraw ? 'sv-in' : '');
      const top = el('div', 'sv-dim-top'); top.append(el('span', 'sv-dim-name', nome));
      const v = mk(f2(r['media_' + k]), 'media_' + k, esc, 'sv-dim-val'); v.style.fontWeight = '400'; top.append(v);
      const bar = el('div', 'sv-dim-bar'); const fill = el('i'); fill.style.width = (r['otimo_' + k] ?? 0) + '%'; bar.append(fill);
      if (esc !== 'geral') { const m = el('em'); m.style.left = `calc(${g['otimo_' + k]}% - 1px)`; bar.append(m); }
      const sub = el('div', 'sv-dim-sub');
      const a = el('span'); a.append(mk(pct(r['otimo_' + k]), 'otimo_' + k, esc), ' de "Ótimo"');
      const b = el('span');
      if (esc !== 'geral' && r['otimo_' + k] != null) { const diff = r['otimo_' + k] - g['otimo_' + k]; b.className = Math.abs(diff) < 0.05 ? '' : diff > 0 ? 'sv-good' : 'sv-bad'; b.textContent = sgn(diff, 1, ' p.p.') + ' vs. geral'; }
      else b.textContent = 'média 1–5';
      sub.append(a, b);
      w.append(top, bar, sub);
      return w;
    }));
  }

  // ---------- Knowledge ----------
  function drawConh(X, esc) {
    const box = $('chart-matriz-conh'); box.classList.remove('dash-skeleton'); clearChart(box);
    const tip = tipFor(box);
    const rows = X.k.get(esc) || [];
    const distBox = $('kn-dist');
    if (!rows.length) { empty(box, 'Sem respostas de conhecimento neste recorte.'); distBox.replaceChildren(); return; }
    const W = box.clientWidth; if (!W) return;
    const cell = new Map(rows.map((r) => [r.antes + '|' + r.apos, r]));
    const maxP = d3.max(rows, (r) => r.pct);
    const svg = d3.select(box).insert('svg', '.sv-tip').attr('width', '100%');
    const labL = d3.max(NOTAS, (n) => textW(svg, n, 'var(--cds-font-size-caption)')) + 34, labT = 46;
    const cs = Math.max(34, Math.min(70, (W - labL - 4) / 5));
    const H = labT + cs * 5 + 6, Wd = labL + cs * 5;
    svg.attr('viewBox', `0 0 ${Math.max(W, Wd)} ${H}`).attr('height', H);
    svg.append('text').attr('x', labL).attr('y', 12).style('font-size', 'var(--cds-font-size-caption)').style('fill', 'var(--color-fg-muted)').style('font-weight', 'var(--cds-font-weight-medium)').text('Após o curso →');
    svg.append('text').attr('transform', `translate(10,${labT}) rotate(-90)`).attr('text-anchor', 'end').style('font-size', 'var(--cds-font-size-caption)').style('fill', 'var(--color-fg-muted)').style('font-weight', 'var(--cds-font-weight-medium)').text('Antes do curso →');
    NOTAS.forEach((n, i) => {
      svg.append('text').attr('x', labL + cs * i + cs / 2).attr('y', labT - 10).attr('text-anchor', 'middle').style('font-size', '11px').style('fill', 'var(--color-fg-muted)').text(cs < 50 && n === 'Muito bom' ? 'M. bom' : n);
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
        .on('mousemove', (ev) => showTip(box, tip, ev, `Antes: ${NOTAS[a - 1]} → Após: ${NOTAS[d - 1]}`, [`${fi(c ? c.fichas : 0)} fichas (${pct(p)})`, d > a ? 'Evoluiu ' + (d - a) + ' nível(is)' : d < a ? 'Regrediu' : 'Sem mudança']))
        .on('mouseleave', () => hideTip(tip));
      if (p >= 0.5) svg.append('text').attr('x', xx + cs / 2).attr('y', yy + cs / 2 + 4).attr('text-anchor', 'middle').style('pointer-events', 'none').style('font-size', cs < 46 ? '10px' : 'var(--cds-font-size-caption)').style('font-weight', 'var(--cds-font-weight-medium)').style('fill', amt > 62 ? 'var(--color-bg)' : 'var(--color-fg)').text(f1(p) + '%');
    }
    // marginals as stacked bars
    const tot = d3.sum(rows, (r) => r.fichas);
    const marg = (key) => [1, 2, 3, 4, 5].map((v) => (d3.sum(rows.filter((r) => r[key] === v), (r) => r.fichas) / tot) * 100);
    const r0 = X.e.get(esc);
    distBox.replaceChildren(...[['Antes', 'antes', r0.conhec_antes], ['Após', 'apos', r0.conhec_apos]].map(([lbl, key, m]) => {
      const row = el('div', 'sv-dist-row'); row.append(el('span', '', lbl));
      const st = el('div', 'sv-stack');
      marg(key).forEach((v, i) => { if (v <= 0) return; const s = el('span'); s.style.width = v + '%'; s.style.background = NV[i]; s.title = ''; st.append(s); });
      row.append(st, el('span', 'sv-num', f2(m)));
      return row;
    }));
    const lgd = el('div', 'sv-legend'); lgd.style.margin = '6px 0 0';
    NOTAS.forEach((n, i) => { const s = el('span'); const sw = el('i'); sw.style.background = NV[i]; s.append(sw, n); lgd.append(s); });
    distBox.append(lgd);
  }

  // ---------- Priority matrix ----------
  function drawPrioridade(X, esc) {
    const box = $('chart-prioridade'); box.classList.remove('dash-skeleton'); clearChart(box);
    const tip = tipFor(box);
    const rows = (X.i.get(esc) || []).filter((r) => r.correlacao != null && r.n > 0);
    if (rows.length < 3) { empty(box, 'Amostra insuficiente: a influência exige pelo menos 10 fichas no recorte.'); return; }
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
    q(m.l + 8, m.t + 16, 'start', 'Prioridade', 'var(--color-bad)');
    q(W - m.r - 6, m.t + 16, 'end', 'Manter', 'var(--color-fg-muted)');
    q(m.l + 8, H - m.b - 8, 'start', 'Monitorar', 'var(--color-fg-muted)');
    q(W - m.r - 6, H - m.b - 8, 'end', 'Diferencial', 'var(--color-fg-muted)');
    const xa = svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(Math.max(3, Math.floor(W / 90))).tickFormat((v) => loc(v, 0) + '%').tickSizeOuter(0));
    const ya = svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat((v) => f2(v)).tickSizeOuter(0));
    styleAxis(xa); styleAxis(ya);
    svg.append('text').attr('x', W - m.r).attr('y', H - 6).attr('text-anchor', 'end').style('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)').text('Excelência (% Ótimo) →');
    svg.append('text').attr('transform', `translate(11,${m.t}) rotate(-90)`).attr('text-anchor', 'end').style('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)').text('Influência (correlação) →');
    const isP = (c) => c.pct5 < mx && c.correlacao > my;
    const placed = rows.map((c) => ({ x: x(c.pct5) - 8, y: y(c.correlacao) + 8, w: 16, h: 16 }));
    rows.slice().sort((a, b) => y(a.correlacao) - y(b.correlacao)).forEach((c) => {
      const cx = x(c.pct5), cy = y(c.correlacao);
      const col = isP(c) ? 'var(--color-bad)' : c.pct5 >= mx ? 'var(--sv-accent)' : 'var(--color-fg-muted)';
      svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', isP(c) ? 7 : 5.5).style('fill', col).style('stroke', 'var(--color-panel)').style('stroke-width', 2)
        .on('mousemove', (ev) => showTip(box, tip, ev, `${c.item} · ${c.dimensao}`, [`${pct(c.pct5)} Ótimo · média ${f2(c.media)}`, `Influência r = ${f2(c.correlacao)}`]))
        .on('mouseleave', () => hideTip(tip));
      const t = svg.append('text').style('font-size', 'var(--cds-font-size-caption)').style('fill', 'var(--color-fg)').style('font-weight', isP(c) ? 'var(--cds-font-weight-medium)' : null).text(c.item);
      const tw = t.node().getComputedTextLength();
      let right = cx + 11 + tw < W - m.r, tx = right ? cx + 11 : cx - 11 - tw, ty = cy + 4, tries = 0;
      const hit = (a) => placed.some((p) => !(a.x + a.w < p.x || a.x > p.x + p.w || a.y - 11 > p.y || a.y < p.y - (p.h || 11)));
      const cands = [];
      [[1, 0], [-1, 0], [1, -13], [-1, -13], [1, 13], [-1, 13], [1, -26], [-1, -26], [1, 26], [-1, 26]].forEach(([s, dy]) => { const xx = s > 0 ? cx + 11 : cx - 11 - tw; if (xx >= m.l && xx + tw <= W - m.r) cands.push({ x: xx, y: cy + 4 + dy, w: tw }); });
      const pick = cands.find((cnd) => !hit(cnd)) || cands[0] || { x: tx, y: ty, w: tw };
      tx = pick.x; ty = pick.y; void right; void tries;
      placed.push({ x: tx, y: ty, w: tw, h: 11 });
      t.attr('x', tx).attr('y', ty);
    });
  }

  // ---------- Funnel plot ----------
  function drawFunil(X, esc) {
    const box = $('chart-funil'); box.classList.remove('dash-skeleton'); clearChart(box);
    const tip = tipFor(box);
    const g = X.e.get('geral'), mu = g.indice, sd = g.dp_indice;
    const pts = [...X.e.values()].filter((r) => r.nivel === 'curso' && r.preenchidas > 0 && r.indice != null);
    const W = box.clientWidth; if (!W || !pts.length) return;
    const H = 360, m = { t: 14, r: 18, b: 42, l: 46 };
    const svg = d3.select(box).insert('svg', '.sv-tip').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    const nMin = Math.max(1, d3.min(pts, (p) => p.preenchidas)), nMax = d3.max(pts, (p) => p.preenchidas);
    const x = d3.scaleLog([Math.max(1, nMin * 0.8), nMax * 1.25], [m.l, W - m.r]);
    const lo = (n, z) => mu - (z * sd) / Math.sqrt(n), hi = (n, z) => Math.min(5, mu + (z * sd) / Math.sqrt(n));
    const yMin = Math.max(1, Math.min(d3.min(pts, (p) => p.indice) - 0.05, lo(x.domain()[0], 3.09)));
    const y = d3.scaleLinear([yMin, 5.02], [H - m.b, m.t]);
    const ns = d3.range(0, 101).map((i) => x.domain()[0] * Math.pow(x.domain()[1] / x.domain()[0], i / 100));
    const band = (z) => d3.area().x((n) => x(n)).y0((n) => y(Math.max(yMin, lo(n, z)))).y1((n) => y(hi(n, z)));
    svg.append('path').attr('d', band(3.09)(ns)).style('fill', 'color-mix(in srgb, var(--color-fg) 5%, transparent)');
    svg.append('path').attr('d', band(1.96)(ns)).style('fill', 'color-mix(in srgb, var(--color-fg) 7%, transparent)');
    [1.96, 3.09].forEach((z) => svg.append('path').attr('d', d3.line().x((n) => x(n)).y((n) => y(Math.max(yMin, lo(n, z))))(ns)).style('fill', 'none').style('stroke', 'var(--cds-chart-reference)').style('stroke-width', 1).attr('stroke-dasharray', z > 2 ? '2 3' : null));
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(mu)).attr('y2', y(mu)).style('stroke', 'var(--color-fg-muted)').attr('stroke-dasharray', '4 3');
    svg.append('text').attr('x', m.l + 6).attr('y', y(mu) - 6).attr('text-anchor', 'start').style('font-size', 'var(--cds-font-size-caption)').style('fill', 'var(--color-fg-muted)').text('média geral ' + f2(mu));
    const tv = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].filter((v) => v >= x.domain()[0] && v <= x.domain()[1]);
    const xa = svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickValues(tv).tickFormat((v) => fi(v)).tickSizeOuter(0));
    const ya = svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6).tickFormat((v) => f1(v)).tickSizeOuter(0));
    styleAxis(xa); styleAxis(ya);
    svg.append('text').attr('x', W - m.r).attr('y', H - 6).attr('text-anchor', 'end').style('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)').text('Fichas preenchidas (escala log) →');
    svg.append('text').attr('transform', `translate(11,${m.t}) rotate(-90)`).attr('text-anchor', 'end').style('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)').text('Índice de satisfação →');
    const r0 = X.e.get(esc), p = P();
    const focus = (c) => (r0.nivel === 'geral' ? true : c.area === r0.area);
    const sel = r0.nivel === 'curso' || r0.nivel === 'turma' ? r0.sigla : null;
    const cls = (c) => (c.indice < lo(c.preenchidas, 3.09) ? 'b2' : c.indice < lo(c.preenchidas, 1.96) ? 'b1' : c.indice > hi(c.preenchidas, 1.96) && hi(c.preenchidas, 1.96) < 5 ? 'g' : 'n');
    const col = { b2: 'var(--color-bad)', b1: 'var(--sv-n2)', g: 'var(--sv-accent)', n: 'color-mix(in srgb, var(--color-fg-muted) 70%, transparent)' };
    const sorted = pts.slice().sort((a, b) => (focus(a) ? 1 : 0) - (focus(b) ? 1 : 0));
    sorted.forEach((c) => {
      const k = cls(c), on = focus(c);
      svg.append('circle').attr('cx', x(c.preenchidas)).attr('cy', y(c.indice)).attr('r', c.sigla === sel ? 8 : 5.5)
        .style('fill', col[k]).style('opacity', on ? 1 : 0.18).style('stroke', c.sigla === sel ? 'var(--color-fg)' : 'var(--color-panel)').style('stroke-width', c.sigla === sel ? 2.5 : 1.5).style('cursor', 'pointer')
        .on('mousemove', (ev) => showTip(box, tip, ev, `${c.sigla} · ${c.rotulo}`, [`${fi(c.preenchidas)} fichas · índice ${f2(c.indice)}`, `${pct(c.pct_otimo)} Ótimo`, k === 'b2' ? 'Abaixo do limite de 99,8%' : k === 'b1' ? 'Abaixo do limite de 95%' : k === 'g' ? 'Acima do esperado' : 'Dentro da variação esperada']))
        .on('mouseleave', () => hideTip(tip))
        .on('click', () => drill(c));
    });
    const placed = [];
    sorted.filter((c) => focus(c) && (cls(c) === 'b2' || cls(c) === 'b1' || c.sigla === sel)).forEach((c) => {
      const cx = x(c.preenchidas), cy = y(c.indice);
      const t = svg.append('text').style('font-size', '11px').style('fill', 'var(--color-fg)').style('pointer-events', 'none').text(c.sigla);
      const tw = t.node().getComputedTextLength();
      let tx = cx + 9 + tw < W - m.r ? cx + 9 : cx - 9 - tw, ty = cy + 4, tries = 0;
      while (placed.some((q) => Math.abs(q.y - ty) < 11 && !(tx + tw < q.x || tx > q.x + q.w)) && tries < 6) { ty += 11; tries++; }
      placed.push({ x: tx, y: ty, w: tw });
      t.attr('x', tx).attr('y', ty);
    });
  }

  // ---------- Participation ----------
  function drawParticipacao(X, esc) {
    const box = $('part-list'); box.classList.remove('dash-skeleton');
    const r0 = X.e.get(esc);
    const rows = partRows(X, esc).slice().sort((a, b) => (a.taxa_resposta ?? -1) - (b.taxa_resposta ?? -1) || b.fichas - a.fichas);
    const lvl = rows[0]?.nivel;
    $('part-title').textContent = 'Situação das fichas por ' + (lvl === 'area' ? 'área' : lvl === 'curso' ? 'curso' : 'turma');
    const lg = $('lg-part');
    lg.replaceChildren(...[['Preenchidas', 'var(--sv-accent)'], ['Não preenchidas', 'var(--sv-n3)'], ['Faltosos', 'var(--sv-n2)']].map(([t, c]) => { const s = el('span'); const sw = el('i'); sw.style.background = c; s.append(sw, t); return s; }));
    if (!rows.length) { box.replaceChildren(el('div', 'sv-empty', 'Sem registros.')); return; }
    box.replaceChildren(...rows.map((r) => {
      const row = el('div', 'sv-part-row' + (r.escopo === esc ? ' sv-cur' : ''));
      const nm = el('div', 'sv-part-name');
      nm.append(r.nivel === 'curso' ? r.sigla + ' · ' + r.rotulo : r.rotulo, el('small', '', fi(r.fichas) + ' fichas'));
      nm.title = r.nivel === 'curso' ? r.sigla + ' · ' + r.rotulo : r.rotulo;
      const st = el('div', 'sv-stack');
      [[r.preenchidas, 'var(--sv-accent)'], [r.nao_preenchidas, 'var(--sv-n3)'], [r.faltosos, 'var(--sv-n2)']].forEach(([v, c]) => { if (!v) return; const s = el('span'); s.style.width = (v / r.fichas) * 100 + '%'; s.style.background = c; st.append(s); });
      const rate = el('div', 'sv-part-rate' + (r.taxa_resposta != null && r.taxa_resposta < 50 ? ' sv-bad' : ''), pct(r.taxa_resposta));
      row.append(nm, st, rate);
      row.addEventListener('click', () => drill(r));
      row.addEventListener('mousemove', (ev) => showTip(box.parentElement, tipFor(box.parentElement), ev, nm.title, [['var(--sv-accent)', `Preenchidas: ${fi(r.preenchidas)}`], ['var(--sv-n3)', `Não preenchidas: ${fi(r.nao_preenchidas)}`], ['var(--sv-n2)', `Faltosos: ${fi(r.faltosos)} (${pct(r.taxa_ausencia)})`]]));
      row.addEventListener('mouseleave', () => hideTip(tipFor(box.parentElement)));
      return row;
    }));
    void r0;
  }

  // ---------- Heatmap ----------
  function drawHeat(X, esc) {
    const wrap = $('heat-wrap'); wrap.classList.remove('dash-skeleton');
    const p = P(), minN = p.minN ?? 5, metr = p.metrica || 'media';
    const all = compRows(X, esc).filter((r) => r.preenchidas > 0);
    const rows = all.filter((r) => r.preenchidas >= minN).sort((a, b) => (metr === 'media' ? b.indice - a.indice : b.pct_otimo - a.pct_otimo));
    $('heat-hidden').textContent = all.length - rows.length > 0 ? `· ${all.length - rows.length} ${all[0]?.nivel === 'turma' ? 'turma' : 'curso'}${all.length - rows.length > 1 ? 's' : ''} com menos de ${minN} fichas oculto${all.length - rows.length > 1 ? 's' : ''}` : '';
    if (!rows.length) { wrap.replaceChildren(el('div', 'sv-empty', 'Nenhuma linha atinge a base mínima. Reduza a base mínima no filtro.')); return; }
    const ref = new Map((X.i.get('geral') || []).map((r) => [r.chave, r])), g = X.e.get('geral');
    const keys = [...ref.keys()];
    const val = (it) => (it ? (metr === 'media' ? it.media : it.pct5) : null);
    const span = metr === 'media' ? 0.3 : 15;
    const color = (v, rv) => { if (v == null || rv == null) return 'transparent'; const d = v - rv, a = Math.min(1, Math.abs(d) / span) * 64; return `color-mix(in srgb, ${d >= 0 ? 'var(--sv-accent)' : 'var(--color-bad)'} ${a.toFixed(0)}%, transparent)`; };
    const fmt = (v) => (v == null ? '—' : metr === 'media' ? f2(v) : loc(v, 0) + '%');
    const t = el('table', 'sv-heat');
    const thead = el('thead');
    const h1 = el('tr'); h1.append(el('th'), el('th'), el('th'));
    [['Programa e metodologia', 3], ['Organização', 4], ['Instrutor', 3]].forEach(([n, c]) => { const th = el('th', '', n); th.colSpan = c; th.style.borderBottom = '1px solid var(--color-border-line)'; th.style.top = '0'; h1.append(th); });
    const h2 = el('tr');
    h2.append(el('th', '', rows[0].nivel === 'turma' ? 'Turma' : 'Curso'), el('th', '', 'Fichas'), el('th', '', metr === 'media' ? 'Índice' : '% Ótimo geral'));
    keys.forEach((k) => h2.append(el('th', '', CURTO[k])));
    h1.querySelectorAll('th').forEach((th) => { th.style.position = 'static'; });
    thead.append(h1, h2);
    const tb = el('tbody');
    const gi = metr === 'media' ? g.indice : g.pct_otimo;
    rows.forEach((r) => {
      const tr = el('tr', r.escopo === esc ? 'sv-cur' : '');
      const its = new Map((X.i.get(r.escopo) || []).map((x) => [x.chave, x]));
      const nm = el('td', '', r.nivel === 'curso' ? r.sigla + ' · ' + r.rotulo : r.rotulo); nm.title = nm.textContent;
      const iv = metr === 'media' ? r.indice : r.pct_otimo;
      const idx = el('td', 'sv-heat-idx', fmt(iv)); idx.style.background = color(iv, gi);
      tr.append(nm, el('td', '', fi(r.preenchidas)), idx);
      keys.forEach((k) => { const v = val(its.get(k)); const td = el('td', '', fmt(v)); td.style.background = color(v, val(ref.get(k))); tr.append(td); });
      tr.addEventListener('click', () => drill(r));
      tb.append(tr);
    });
    const refRow = el('tr'); refRow.style.cursor = 'default';
    const rn = el('td', '', 'Referência: todos os cursos'); rn.style.color = 'var(--color-fg-muted)';
    refRow.append(rn, el('td', '', fi(g.preenchidas)), el('td', 'sv-heat-idx', fmt(gi)));
    keys.forEach((k) => refRow.append(el('td', '', fmt(val(ref.get(k))))));
    [...refRow.children].forEach((td) => { td.style.borderTop = '1px solid var(--color-border-line)'; td.style.borderRadius = '0'; });
    tb.append(refRow);
    t.append(thead, tb);
    wrap.replaceChildren(t);
    $('heat-note').textContent = `${metr === 'media' ? 'Média (1–5)' : 'Percentual de "Ótimo"'} por pergunta. A cor mostra a distância para a referência de todos os cursos na mesma pergunta (escala de ±${metr === 'media' ? '0,30 ponto' : '15 p.p.'}).`;
  }

  // ---------- Ranking ----------
  const sortState = { key: 'indice', dir: 'desc' };
  let search = '';
  $('rank-search').addEventListener('input', (e) => { search = e.target.value.trim().toLowerCase(); if (IDX) drawRanking(IDX, escopoAtual(IDX)); });
  const COLS = [
    { f: 'rotulo', t: 'Curso', type: 's' },
    { f: 'area', t: 'Área', type: 's', opt: true },
    { f: 'preenchidas', t: 'Fichas', type: 'n', r: true },
    { f: 'taxa_resposta', t: 'Resposta', type: 'n', r: true, opt: true },
    { f: 'indice', t: 'Índice', type: 'n' },
    { f: 'pct_otimo', t: '% Ótimo', type: 'n', r: true },
    { f: 'ganho', t: 'Ganho conhec.', type: 'n', r: true, opt: true },
    { f: 'item_mais_fraco', t: 'Pergunta mais fraca', type: 's', opt: true },
  ];
  function drawRanking(X, esc) {
    const wrap = $('rank-wrap'); wrap.classList.remove('dash-skeleton');
    const minN = P().minN ?? 5;
    const all = compRows(X, esc).filter((r) => r.preenchidas > 0);
    const lvlT = all[0]?.nivel === 'turma';
    const r0 = X.e.get(esc);
    $('rank-title').textContent = lvlT ? `Ranking de turmas · ${r0.sigla}` : r0.nivel === 'area' ? `Ranking de cursos · área ${r0.area}` : 'Ranking de cursos';
    let rows = all.filter((r) => r.preenchidas >= minN);
    if (search) rows = rows.filter((r) => (r.rotulo + ' ' + r.sigla + ' ' + r.area).toLowerCase().includes(search));
    const c = COLS.find((x) => x.f === sortState.key);
    rows.sort((a, b) => { const va = a[c.f], vb = b[c.f]; if (va == null) return 1; if (vb == null) return -1; const o = c.type === 'n' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR', { numeric: true }); return sortState.dir === 'asc' ? o : -o; });
    const head = $('rank-head');
    head.replaceChildren(...COLS.map((col) => {
      const th = el('th', (col.r ? 'r ' : '') + (col.opt ? 'sv-opt' : '')); th.dataset.field = col.f;
      if (sortState.key === col.f) th.setAttribute('aria-sort', sortState.dir === 'asc' ? 'ascending' : 'descending');
      const b = el('button', '', (col.f === 'rotulo' && lvlT ? 'Turma' : col.t) + (sortState.key === col.f ? (sortState.dir === 'asc' ? ' ↑' : ' ↓') : ''));
      b.type = 'button';
      b.addEventListener('click', () => { if (sortState.key === col.f) sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc'; else { sortState.key = col.f; sortState.dir = col.type === 'n' ? 'desc' : 'asc'; } drawRanking(IDX, escopoAtual(IDX)); });
      th.append(b); return th;
    }));
    const vals = all.map((r) => r.indice).filter((v) => v != null);
    const lo = Math.max(1, Math.floor((d3.min(vals) - 0.1) * 10) / 10);
    const gIdx = X.e.get('geral').indice;
    const body = $('rank-body');
    body.replaceChildren(...rows.map((r) => {
      const tr = el('tr', r.escopo === esc ? 'sv-cur' : ''); tr.dataset.key = r.escopo;
      const nm = el('td'); const d = el('div', 'sv-cell-name', r.rotulo); if (r.nivel === 'curso') d.append(el('small', '', r.sigla)); nm.append(d); nm.title = r.rotulo;
      const ib = el('td'); const bx = el('div', 'sv-inbar'); const tr2 = el('span'); const fl = el('i'); fl.style.width = (((r.indice ?? lo) - lo) / (5 - lo)) * 100 + '%'; if (r.indice < gIdx - 0.15) fl.style.background = 'var(--color-bad)'; tr2.append(fl); bx.append(el('b', 'sv-num', f2(r.indice)), tr2); ib.append(bx);
      const tx = el('td', 'r sv-opt' + (r.taxa_resposta != null && r.taxa_resposta < 50 ? ' sv-bad' : ''), pct(r.taxa_resposta));
      const fw = el('td', 'sv-opt'); fw.textContent = r.item_mais_fraco ? `${r.item_mais_fraco} · ${loc(r.otimo_item_mais_fraco, 0)}%` : '—';
      tr.append(nm, el('td', 'sv-opt', r.area), el('td', 'r', fi(r.preenchidas)), tx, ib, el('td', 'r', pct(r.pct_otimo)), el('td', 'r sv-opt', r.ganho == null ? '—' : sgn(r.ganho, 2)), fw);
      tr.addEventListener('click', () => drill(r));
      return tr;
    }));
    const hidden = all.length - all.filter((r) => r.preenchidas >= minN).length;
    $('rank-foot').textContent = `${rows.length} ${lvlT ? 'turmas' : 'cursos'} listados` + (hidden ? ` · ${hidden} com menos de ${minN} fichas ocultos pela base mínima` : '') + ' · barra vermelha: índice mais de 0,15 abaixo da média geral.';
  }

  // ---------- Quality ----------
  function drawQualidade(Q) {
    const t = $('tabela-qualidade'); t.classList.remove('dash-skeleton');
    $('qual-body').replaceChildren(...Q.map((q) => { const tr = el('tr'); tr.dataset.key = q.indicador; tr.style.cursor = 'default'; const v = el('td', 'r', q.valor); v.style.fontWeight = 'var(--cds-font-weight-medium)'; v.style.whiteSpace = 'nowrap'; const dt = el('td', '', q.detalhe); dt.style.color = 'var(--color-fg-muted)'; tr.append(el('td', '', q.indicador), v, dt); return tr; }));
  }

  // ---------- Executive reading ----------
  function drawExec(X, esc) {
    const r = X.e.get(esc), g = X.e.get('geral');
    const its = (X.i.get(esc) || []).filter((x) => x.n > 0);
    const li = (parts) => { const l = el('li'); para(l, parts); return l; };
    const mi = (text, field, it, cls) => { const b = el('b', cls, text); b.dataset.source = 'itens'; b.dataset.field = field; b.dataset.where = 'escopo=' + enc(esc) + '&chave=' + enc(it.chave); return b; };
    ['ex-fortes', 'ex-atencao', 'ex-acoes'].forEach((id) => $(id).classList.remove('dash-skeleton'));
    if (!its.length) {
      $('ex-fortes').replaceChildren(li(['Sem fichas preenchidas neste recorte.']));
      $('ex-atencao').replaceChildren(li(['Das ', mk(fi(r.fichas), 'fichas', esc), ' fichas registradas, ', mk(fi(r.nao_preenchidas), 'nao_preenchidas', esc), ' não foram preenchidas.']));
      $('ex-acoes').replaceChildren(li(['Recolher as fichas pendentes antes de avaliar este recorte.']));
      return;
    }
    const byOt = [...its].sort((a, b) => b.pct5 - a.pct5);
    const fortes = [];
    fortes.push(li([mi(byOt[0].item, 'item', byOt[0]), ' e ', mi(byOt[1].item, 'item', byOt[1]), ' lideram, com ', mi(pct(byOt[0].pct5), 'pct5', byOt[0]), ' e ', mi(pct(byOt[1].pct5), 'pct5', byOt[1]), ' de "Ótimo".']));
    const dims = DIMS.map(([n, k]) => ({ n, k, v: r['otimo_' + k] })).filter((d) => d.v != null).sort((a, b) => b.v - a.v);
    if (dims.length) fortes.push(li(['A dimensão mais bem avaliada é ' + dims[0].n + ' (', mk(pct(dims[0].v), 'otimo_' + dims[0].k, esc), ' Ótimo, média ', mk(f2(r['media_' + dims[0].k]), 'media_' + dims[0].k, esc), ').']));
    if (r.ganho != null) fortes.push(li(['Aprendizagem percebida: ', mk(pct(r.pct_evoluiu), 'pct_evoluiu', esc), ' declararam evolução, com ganho médio de ', mk(sgn(r.ganho, 2), 'ganho', esc), ' ponto na escala de 5.']));
    if (esc !== 'geral' && r.indice > g.indice + 0.05) fortes.push(li(['Índice acima da média geral: ', mk(f2(r.indice), 'indice', esc), ' contra ', mk(f2(g.indice), 'indice', 'geral'), '.']));
    $('ex-fortes').replaceChildren(...fortes);

    const at = [];
    const w = byOt[byOt.length - 1], w2 = byOt[byOt.length - 2];
    at.push(li([mi(w.item, 'item', w), ' é a pergunta mais distante da excelência: ', mi(pct(w.pct5), 'pct5', w), ' de "Ótimo" e ', mi(pct(w.pct_ate_bom), 'pct_ate_bom', w), ' das notas em "Bom" ou abaixo. Logo atrás vem ', mi(w2.item, 'item', w2), ' (', mi(pct(w2.pct5), 'pct5', w2), ').']));
    if (r.taxa_resposta != null && r.taxa_resposta < 70) at.push(li(['Coleta incompleta: só ', mk(pct(r.taxa_resposta), 'taxa_resposta', esc, 'sv-bad'), ' das fichas esperadas voltaram preenchidas (', mk(fi(r.nao_preenchidas), 'nao_preenchidas', esc), ' em branco). Os resultados podem não representar a turma inteira.']));
    if (r.taxa_ausencia != null && r.taxa_ausencia >= 10) at.push(li(['Ausência relevante: ', mk(pct(r.taxa_ausencia), 'taxa_ausencia', esc), ' das fichas são de alunos faltosos (', mk(fi(r.faltosos), 'faltosos', esc), ').']));
    if (r.pct_nota_maxima != null && r.pct_nota_maxima >= 50) at.push(li(['Efeito teto: ', mk(pct(r.pct_nota_maxima), 'pct_nota_maxima', esc), ' das fichas marcaram "Ótimo" em tudo. Vale acompanhar % Ótimo e comentários, não só a média.']));
    if (r.nivel === 'geral' || r.nivel === 'area') {
      const mu = g.indice, sd = g.dp_indice;
      const out = compRows(X, esc).filter((c) => c.preenchidas > 0 && c.indice != null && c.indice < mu - (3.09 * sd) / Math.sqrt(c.preenchidas));
      if (out.length) at.push(li([String(out.length), out.length > 1 ? ' cursos ficam' : ' curso fica', ' abaixo do limite de controle de 99,8% no funil: ', ...out.slice(0, 4).flatMap((c, i) => [i ? ', ' : '', mk(c.sigla, 'sigla', c.escopo), ' (', mk(f2(c.indice), 'indice', c.escopo), ')']), out.length > 4 ? ' e outros.' : '.']));
    }
    $('ex-atencao').replaceChildren(...at);

    const ac = [];
    const cor = its.filter((x) => x.correlacao != null);
    if (cor.length >= 3) {
      const mx = d3.mean(cor, (c) => c.pct5), my = d3.mean(cor, (c) => c.correlacao);
      const pri = cor.filter((c) => c.pct5 < mx && c.correlacao > my).sort((a, b) => a.pct5 - b.pct5);
      if (pri.length) ac.push(li(['Priorizar ', ...pri.slice(0, 2).flatMap((c, i) => [i ? ' e ' : '', mi(c.item, 'item', c)]), ': ', pri.length > 1 ? 'estão' : 'está', ' abaixo da média de excelência e entre as que mais se movem junto com a percepção geral (r = ', mi(f2(pri[0].correlacao), 'correlacao', pri[0]), ').']));
    }
    if (w.dimensao === 'Programa e metodologia') ac.push(li(['Rever o desenho do programa (', mi(w.item, 'item', w), '): mais prática guiada, exercícios aplicados ao posto de trabalho e material alinhado ao conteúdo.']));
    else if (w.dimensao === 'Organização') ac.push(li(['Atacar a logística (', mi(w.item, 'item', w), '): checklist de sala, equipamentos e comunicação prévia com as turmas.']));
    else ac.push(li(['Apoiar os instrutores em ', mi(w.item, 'item', w), ' com observação de aula e trocas entre pares.']));
    const kids = partRows(X, esc).filter((c) => c.preenchidas + c.nao_preenchidas >= 20 && c.taxa_resposta != null).sort((a, b) => a.taxa_resposta - b.taxa_resposta);
    if (kids.length && kids[0].taxa_resposta < 60) ac.push(li(['Recuperar a coleta onde ela é mais baixa: ', ...kids.slice(0, 3).flatMap((c, i) => [i ? ', ' : '', mk(c.nivel === 'curso' ? c.sigla : c.rotulo, c.nivel === 'curso' ? 'sigla' : 'rotulo', c.escopo), ' (', mk(pct(c.taxa_resposta), 'taxa_resposta', c.escopo), ')']), '. Aplicar a ficha ao fim da última aula, antes da saída, costuma elevar a taxa.']));
    if (r.pct_nota_maxima >= 50) ac.push(li(['Incluir na ficha uma pergunta aberta obrigatória ("o que mudaria?") para captar melhorias que a escala de 1 a 5 não mostra.']));
    $('ex-acoes').replaceChildren(...ac);
  }

  // ---------- Export to PNG ----------
  const ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5v8m0 0L5 7.5m3 3l3-3M3 13.5h10"/></svg>';
  document.querySelectorAll('.sv-png').forEach((b) => { b.innerHTML = ICON; b.append(el('span', '', 'PNG')); b.setAttribute('aria-label', 'Salvar como imagem PNG'); b.title = 'Salvar como imagem PNG em alta resolução'; b.addEventListener('click', () => exportar(b)); });
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
    const isHTML = src.namespaceURI === 'http://www.w3.org/1999/xhtml';
    if (tag === 'svg' || tag === 'img' || tag === 'canvas') s += 'width:' + cs.width + ';height:' + cs.height + ';';
    else if (isHTML && cs.display !== 'inline' && cs.display !== 'none') {
      s += 'width:' + cs.width + ';';
      if (!src.textContent.trim()) s += 'height:' + cs.height + ';';
    }
    if (isHTML && (tag === 'button' || tag === 'select' || tag === 'input')) for (const q in NON) s += q + ':' + cs.getPropertyValue(q) + ';';
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
    clone.querySelectorAll('.sv-noexport, .sv-png, .sv-tip, .sv-preview, input').forEach((e) => e.remove());
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
    const now = new Date();
    foot.textContent = `Avaliação de reação dos treinamentos · ${IDX ? rotuloEscopo(IDX, escopoAtual(IDX)) : ''} · gerado em ${now.toLocaleDateString('pt-BR')}`;
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
    return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('PNG vazio'))), 'image/png'));
  }
  function preview(blob, fname, node) {
    const host = node.classList.contains('sv-card') ? node : node.parentElement;
    host.querySelectorAll(':scope .sv-preview').forEach((p) => p.remove());
    const url = URL.createObjectURL(blob);
    const box = el('div', 'sv-preview sv-noexport');
    const img = el('img'); img.src = url; img.alt = fname;
    const p = el('p', '', 'Se o download não iniciar, clique com o botão direito na imagem e escolha "Salvar imagem como…".');
    const row = el('div');
    const a = el('a', '', 'Baixar ' + fname); a.href = url; a.download = fname;
    const x = el('button', 'sv-btn', 'Fechar'); x.type = 'button'; x.addEventListener('click', () => { box.remove(); URL.revokeObjectURL(url); });
    row.append(a, x); box.append(p, img, row);
    if (node.classList.contains('sv-card')) { const head = node.querySelector('.sv-card-head'); head.after(box); } else node.before(box);
    try { a.click(); } catch (e) { /* preview stays */ }
  }
  const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60);
  async function exportar(btn) {
    const node = document.getElementById(btn.dataset.export); if (!node) return;
    const lbl = btn.querySelector('span'); const old = 'PNG';
    lbl.textContent = 'Gerando…'; btn.disabled = true;
    try {
      const blob = await renderPNG(node);
      const fname = `${btn.dataset.name}_${slug(IDX ? rotuloEscopo(IDX, escopoAtual(IDX)) : 'geral')}.png`;
      if (DL === undefined) await Promise.race([dlReady, new Promise((r) => setTimeout(r, 1500))]);
      let done = false;
      if (DL) { try { await DL.save({ filename: fname, data: blob }); done = true; } catch (e) { if (e && (e.code === 'declined' || e.code === 'rate_limited')) done = true; } }
      if (!done) preview(blob, fname, node);
      lbl.textContent = old;
    } catch (e) {
      lbl.textContent = 'Falhou'; setTimeout(() => { lbl.textContent = old; }, 2500);
    } finally { btn.disabled = false; }
  }

  // ---------- main ----------
  dash.onData(() => {
    const dE = dash.data('escopos'), dI = dash.data('itens'), dK = dash.data('conhecimento'), dQ = dash.data('qualidade'), dC = dash.data('cursos');
    const ok = (d) => d.status === 'ok' && Array.isArray(d.data) && d.data.length;
    const bad = (d) => ['error', 'connect', 'declined', 'missing'].includes(d.status);
    if (ok(dQ)) drawQualidade(dQ.data); else if (bad(dQ)) fail($('tabela-qualidade'));
    if (!(ok(dE) && ok(dI) && ok(dK) && ok(dC))) {
      if ([dE, dI, dK, dC].some(bad)) ['chart-itens', 'dims', 'chart-matriz-conh', 'chart-prioridade', 'chart-funil', 'heat-wrap', 'rank-wrap', 'part-list'].forEach((id) => fail($(id)));
      return;
    }
    const X = indexes(dE.data, dI.data, dK.data, dC.data);
    const esc = escopoAtual(X);
    const nCursos = X.cursos.length, nAreas = new Set(X.cursos.map((c) => c.area)).size, nTurmas = [...X.e.values()].filter((r) => r.nivel === 'turma').length;
    $('sv-eyebrow-n').textContent = `${nCursos} cursos · ${nAreas} áreas · ${fi(nTurmas)} turmas`;
    drawFilters(X, esc);
    drawKpis(X, esc);
    drawTake(X, esc);
    drawItens(X, esc);
    drawDims(X, esc);
    drawConh(X, esc);
    drawPrioridade(X, esc);
    drawFunil(X, esc);
    drawHeat(X, esc);
    drawRanking(X, esc);
    drawParticipacao(X, esc);
    drawExec(X, esc);
    firstDraw = false;
  });
})();
