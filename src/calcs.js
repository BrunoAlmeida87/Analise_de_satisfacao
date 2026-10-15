dash.calc('escopos', {
  title: 'Indicadores por recorte',
  description: 'Um registro por recorte (geral, área, curso, turma): fichas por situação, taxa de resposta, índice de satisfação, distribuição das notas, médias por dimensão, pergunta mais fraca e evolução do conhecimento.',
  inputs: ['relatorios', 'cursos'],
  fn: (relatorios, cursos) => {
    const R = ['objetivos', 'teoria_pratica', 'material', 'pontualidade', 'instalacoes', 'apoio_adm', 'audiovisuais', 'dominio', 'clareza', 'duvidas'];
    const ALL = R.concat(['conhec_antes', 'conhec_apos']);
    const DIM = { programa: [0, 1, 2], organizacao: [3, 4, 5, 6], instrutor: [7, 8, 9] };
    const nome = Object.fromEntries(cursos.map((c) => [c.sigla, c.curso]));
    const num = (x) => (x === '' || x == null ? null : Number(x));
    const S = new Map();
    const get = (id, o) => {
      if (!S.has(id)) S.set(id, { escopo: id, ...o, total: 0, pre: 0, nao: 0, fal: 0, falr: 0, parc: 0, dist: [0, 0, 0, 0, 0], it: R.map(() => [0, 0, 0]), ni: 0, si: 0, si2: 0, max: 0, nk: 0, ka: 0, kd: 0, ev: 0, ig: 0, rg: 0 });
      return S.get(id);
    };
    for (const r of relatorios) {
      const a = r.sigla.slice(0, 4), t = Number(r.turma);
      const alvo = [
        get('geral', { nivel: 'geral', pai: '', rotulo: 'Todos os cursos', area: '', sigla: '', turma: null }),
        get('A:' + a, { nivel: 'area', pai: 'geral', rotulo: 'Área ' + a, area: a, sigla: '', turma: null }),
        get('C:' + r.sigla, { nivel: 'curso', pai: 'A:' + a, rotulo: nome[r.sigla] || r.sigla, area: a, sigla: r.sigla, turma: null }),
        get('T:' + r.sigla + ':' + t, { nivel: 'turma', pai: 'C:' + r.sigla, rotulo: 'Turma ' + t, area: a, sigla: r.sigla, turma: t }),
      ];
      const v = R.map((k) => num(r[k])), ok = v.filter((x) => x != null);
      const answered = ALL.filter((k) => num(r[k]) != null).length;
      const ka = num(r.conhec_antes), kd = num(r.conhec_apos);
      for (const s of alvo) {
        s.total++;
        if (r.status === 'Faltoso') { s.fal++; if (answered) s.falr++; continue; }
        if (r.status !== 'Preenchido') { s.nao++; continue; }
        s.pre++;
        if (answered > 0 && answered < ALL.length) s.parc++;
        v.forEach((x, i) => { if (x != null) { s.dist[x - 1]++; s.it[i][0]++; s.it[i][1] += x; if (x === 5) s.it[i][2]++; } });
        if (ok.length) { const m = ok.reduce((p, x) => p + x, 0) / ok.length; s.ni++; s.si += m; s.si2 += m * m; if (ok.every((x) => x === 5)) s.max++; }
        if (ka != null && kd != null) { s.nk++; s.ka += ka; s.kd += kd; if (kd > ka) s.ev++; else if (kd === ka) s.ig++; else s.rg++; }
      }
    }
    const r1 = (x) => (x == null || !isFinite(x) ? null : Math.round(x * 10) / 10);
    const r2 = (x) => (x == null || !isFinite(x) ? null : Math.round(x * 100) / 100);
    const pc = (a, b) => (b ? r1((a / b) * 100) : null);
    return [...S.values()].map((s) => {
      const nr = s.dist.reduce((p, x) => p + x, 0);
      const dim = (ix) => { let n = 0, sum = 0, o = 0; ix.forEach((i) => { n += s.it[i][0]; sum += s.it[i][1]; o += s.it[i][2]; }); return [n ? r2(sum / n) : null, pc(o, n)]; };
      const [mp, op] = dim(DIM.programa), [mo, oo] = dim(DIM.organizacao), [mi, oi] = dim(DIM.instrutor);
      let fraco = null;
      R.forEach((k, i) => { const [n, sum, o] = s.it[i]; if (!n) return; const p = o / n, m = sum / n; if (!fraco || p < fraco.p || (p === fraco.p && m < fraco.m)) fraco = { k, p, m }; });
      const dp = s.ni > 1 ? Math.sqrt(Math.max(0, (s.si2 - (s.si * s.si) / s.ni) / (s.ni - 1))) : null;
      return {
        escopo: s.escopo, nivel: s.nivel, pai: s.pai, rotulo: s.rotulo, area: s.area, sigla: s.sigla, turma: s.turma,
        fichas: s.total, preenchidas: s.pre, nao_preenchidas: s.nao, faltosos: s.fal, faltosos_com_respostas: s.falr, fichas_parciais: s.parc,
        taxa_resposta: pc(s.pre, s.pre + s.nao), taxa_ausencia: pc(s.fal, s.total),
        respostas_itens: nr, indice: s.ni ? r2(s.si / s.ni) : null, dp_indice: dp == null ? null : Math.round(dp * 1000) / 1000,
        pct_otimo: pc(s.dist[4], nr), pct_muito_bom: pc(s.dist[3], nr), pct_bom: pc(s.dist[2], nr), pct_regular: pc(s.dist[1], nr), pct_fraco: pc(s.dist[0], nr),
        pct_ate_bom: pc(s.dist[0] + s.dist[1] + s.dist[2], nr), pct_nota_maxima: pc(s.max, s.ni),
        media_programa: mp, otimo_programa: op, media_organizacao: mo, otimo_organizacao: oo, media_instrutor: mi, otimo_instrutor: oi,
        item_mais_fraco: fraco ? fraco.k : null, otimo_item_mais_fraco: fraco ? r1(fraco.p * 100) : null,
        conhec_antes: s.nk ? r2(s.ka / s.nk) : null, conhec_apos: s.nk ? r2(s.kd / s.nk) : null, ganho: s.nk ? r2((s.kd - s.ka) / s.nk) : null,
        pct_evoluiu: pc(s.ev, s.nk), pct_igual: pc(s.ig, s.nk), pct_regrediu: pc(s.rg, s.nk), n_conhecimento: s.nk,
      };
    });
  },
});

dash.calc('itens', {
  title: 'Indicadores por pergunta',
  description: 'Para cada recorte e cada uma das 10 perguntas de reação: respostas, média, desvio-padrão, distribuição das notas 1–5 e correlação da pergunta com a média das demais (influência).',
  inputs: ['relatorios'],
  fn: (relatorios) => {
    const R = [
      ['objetivos', 'programa'], ['teoria_pratica', 'programa'], ['material', 'programa'],
      ['pontualidade', 'organizacao'], ['instalacoes', 'organizacao'], ['apoio_adm', 'organizacao'], ['audiovisuais', 'organizacao'],
      ['dominio', 'instrutor'], ['clareza', 'instrutor'], ['duvidas', 'instrutor'],
    ];
    const num = (x) => (x === '' || x == null ? null : Number(x));
    const S = new Map();
    const acc = () => R.map(() => ({ c: [0, 0, 0, 0, 0], n: 0, sx: 0, sxx: 0, cn: 0, cx: 0, cy: 0, cxx: 0, cyy: 0, cxy: 0 }));
    for (const r of relatorios) {
      if (r.status !== 'Preenchido') continue;
      const ids = ['geral', 'A:' + r.sigla.slice(0, 4), 'C:' + r.sigla, 'T:' + r.sigla + ':' + Number(r.turma)];
      const v = R.map(([k]) => num(r[k]));
      const tot = v.reduce((p, x) => p + (x ?? 0), 0), cnt = v.filter((x) => x != null).length;
      for (const id of ids) {
        if (!S.has(id)) S.set(id, acc());
        const A = S.get(id);
        v.forEach((x, i) => {
          if (x == null) return;
          const q = A[i]; q.c[x - 1]++; q.n++; q.sx += x; q.sxx += x * x;
          if (cnt > 1) { const y = (tot - x) / (cnt - 1); q.cn++; q.cx += x; q.cy += y; q.cxx += x * x; q.cyy += y * y; q.cxy += x * y; }
        });
      }
    }
    const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100;
    const out = [];
    for (const [escopo, A] of S) {
      A.forEach((q, i) => {
        const p = (k) => (q.n ? r1((q.c[k] / q.n) * 100) : null);
        const den = Math.sqrt((q.cn * q.cxx - q.cx * q.cx) * (q.cn * q.cyy - q.cy * q.cy));
        out.push({
          escopo, ordem: i + 1, chave: R[i][0], dimensao: R[i][1], n: q.n,
          media: q.n ? r2(q.sx / q.n) : null,
          dp: q.n > 1 ? r2(Math.sqrt(Math.max(0, (q.sxx - (q.sx * q.sx) / q.n) / (q.n - 1)))) : null,
          pct1: p(0), pct2: p(1), pct3: p(2), pct4: p(3), pct5: p(4),
          pct_ate_bom: q.n ? r1(((q.c[0] + q.c[1] + q.c[2]) / q.n) * 100) : null,
          correlacao: q.cn >= 10 && den > 0 ? r2((q.cn * q.cxy - q.cx * q.cy) / den) : null,
        });
      });
    }
    return out;
  },
});

dash.calc('conhecimento', {
  title: 'Conhecimento antes × após',
  description: 'Para cada recorte, quantas fichas marcaram cada combinação de nota de conhecimento antes e após o curso (1 Fraco a 5 Ótimo), e a parcela sobre as fichas com as duas respostas.',
  inputs: ['relatorios'],
  fn: (relatorios) => {
    const num = (x) => (x === '' || x == null ? null : Number(x));
    const S = new Map(), T = new Map();
    for (const r of relatorios) {
      if (r.status !== 'Preenchido') continue;
      const a = num(r.conhec_antes), d = num(r.conhec_apos);
      if (a == null || d == null) continue;
      const ids = ['geral', 'A:' + r.sigla.slice(0, 4), 'C:' + r.sigla, 'T:' + r.sigla + ':' + Number(r.turma)];
      for (const id of ids) {
        const k = id + '|' + a + '|' + d;
        S.set(k, (S.get(k) || 0) + 1);
        T.set(id, (T.get(id) || 0) + 1);
      }
    }
    return [...S].map(([k, n]) => {
      const [escopo, a, d] = k.split('|');
      return { escopo, antes: Number(a), apos: Number(d), fichas: n, pct: Math.round((n / T.get(escopo)) * 1000) / 10 };
    });
  },
});

dash.calc('qualidade', {
  title: 'Qualidade da base',
  description: 'Contagens que indicam a cobertura e a confiabilidade da base inteira: fichas por situação, respostas em branco, fichas parciais, faltosos com respostas, cursos sem nome ou sem fichas preenchidas, turmas com poucas fichas e efeito teto.',
  inputs: ['relatorios', 'cursos'],
  fn: (relatorios, cursos) => {
    const K = ['objetivos', 'teoria_pratica', 'material', 'pontualidade', 'instalacoes', 'apoio_adm', 'audiovisuais', 'dominio', 'clareza', 'duvidas', 'conhec_antes', 'conhec_apos'];
    const R10 = K.slice(0, 10);
    const has = (r, k) => r[k] !== '' && r[k] != null;
    const pre = relatorios.filter((r) => r.status === 'Preenchido');
    const nao = relatorios.filter((r) => r.status === 'Não preenchido').length;
    const fal = relatorios.filter((r) => r.status === 'Faltoso');
    const branco = pre.reduce((s, r) => s + K.filter((k) => !has(r, k)).length, 0);
    const parciais = pre.filter((r) => { const n = K.filter((k) => has(r, k)).length; return n > 0 && n < K.length; }).length;
    const falr = fal.filter((r) => K.some((k) => has(r, k))).length;
    const semNome = cursos.filter((c) => c.curso === 'Sem nome no cadastro').map((c) => c.sigla);
    const semNomeSet = new Set(semNome);
    const fichasSemNome = relatorios.filter((r) => semNomeSet.has(r.sigla)).length;
    const comPre = new Set(pre.map((r) => r.sigla));
    const semFicha = cursos.filter((c) => !comPre.has(c.sigla)).map((c) => c.sigla);
    const turmas = new Map();
    pre.forEach((r) => { const k = r.sigla + ':' + r.turma; turmas.set(k, (turmas.get(k) || 0) + 1); });
    const pequenas = [...turmas.values()].filter((n) => n < 5).length;
    const comResp = pre.filter((r) => R10.some((k) => has(r, k)));
    const max = comResp.filter((r) => R10.every((k) => !has(r, k) || Number(r[k]) === 5)).length;
    return [
      { indicador: 'fichas', valor: relatorios.length, base: pre.length, extra: nao, extra2: fal.length, lista: '' },
      { indicador: 'branco', valor: branco, base: pre.length * K.length, extra: null, extra2: null, lista: '' },
      { indicador: 'parciais', valor: parciais, base: pre.length, extra: null, extra2: null, lista: '' },
      { indicador: 'faltosos_resp', valor: falr, base: fal.length, extra: null, extra2: null, lista: '' },
      { indicador: 'sem_fichas', valor: semFicha.length, base: cursos.length, extra: null, extra2: null, lista: semFicha.join(', ') },
      { indicador: 'sem_nome', valor: semNome.length, base: cursos.length, extra: fichasSemNome, extra2: null, lista: semNome.join(', ') },
      { indicador: 'turmas_pequenas', valor: pequenas, base: turmas.size, extra: null, extra2: null, lista: '' },
      { indicador: 'teto', valor: comResp.length ? Math.round((max / comResp.length) * 1000) / 10 : null, base: comResp.length, extra: max, extra2: null, lista: '' },
    ];
  },
});
