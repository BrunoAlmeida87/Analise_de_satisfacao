// Atualizar a base no navegador (só na versão independente): lê a planilha exportada do banco
// (.xlsx, aba SQL Results, uma linha por pergunta) ou um CSV no mesmo formato, e converte para uma linha por ficha,
// com a mesma regra de scripts/prep.py.
(() => {
  const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  const ensureXLSX = () => new Promise((res, rej) => {
    if (window.XLSX) return res();
    const emb = document.getElementById('lib-xlsx');
    if (emb) { const s = document.createElement('script'); s.textContent = emb.textContent; document.head.appendChild(s); return window.XLSX ? res() : rej(new Error('leitor de Excel embutido não carregou')); }
    const s = document.createElement('script'); s.src = XLSX_URL; s.onload = () => res(); s.onerror = () => rej(new Error('não foi possível carregar o leitor de Excel (sem internet?). Salve a planilha como CSV e tente de novo.'));
    document.head.appendChild(s);
  });
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
  const ITEM = [
    [/^OBJETIVOS/, 'objetivos'], [/^EQUILIBRIO/, 'teoria_pratica'], [/^ADEQUACAO/, 'material'], [/^PONTUALIDADE/, 'pontualidade'],
    [/^INSTALACOES/, 'instalacoes'], [/^APOIO/, 'apoio_adm'], [/^RECURSOS/, 'audiovisuais'], [/^DOMINIO/, 'dominio'],
    [/^CLAREZA/, 'clareza'], [/^CAPACIDADE/, 'duvidas'], [/^ANTES/, 'conhec_antes'], [/^APOS/, 'conhec_apos'],
  ];
  const KEYS = ITEM.map((x) => x[1]);
  const itemKey = (s) => { const n = norm(s); const m = ITEM.find(([re]) => re.test(n)); return m ? m[1] : null; };
  const statusOf = (s) => { const n = norm(s); if (n.includes('FALT')) return 'Faltoso'; if (n.includes('NAO PREENCH')) return 'Não preenchido'; if (n.includes('PREENCH')) return 'Preenchido'; return null; };
  const splitCSV = (txt) => {
    const first = txt.split(/\r?\n/, 1)[0];
    const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < txt.length; i++) {
      const ch = txt[i];
      if (q) { if (ch === '"') { if (txt[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && txt[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
  };
  function fromRaw(rows) {
    const hi = rows.findIndex((r) => /SIGLA/.test(norm(r[0])));
    if (hi < 0) throw new Error('cabeçalho com "GTOC_SIGLA" não encontrado');
    const fichas = new Map(), nomes = new Map();
    for (const r of rows.slice(hi + 1)) {
      const sigla = String(r[0] ?? '').trim(); if (!sigla) continue;
      const turma = Number(r[2]); const rel = Number(String(r[3] ?? '').replace(/\D+/g, ''));
      const k = sigla + '|' + turma + '|' + rel;
      const nome = String(r[1] ?? '').replace(/\s+/g, ' ').trim();
      if (nome && nome !== '#N/A' && !nomes.has(sigla)) nomes.set(sigla, nome);
      if (!fichas.has(k)) fichas.set(k, { sigla, turma: String(turma), relatorio: String(rel), status: statusOf(r[4]) || String(r[4] ?? ''), ...Object.fromEntries(KEYS.map((x) => [x, ''])) });
      const key = itemKey(r[6]); if (!key) continue;
      const marks = [7, 8, 9, 10, 11].map((j) => Number(String(r[j] ?? '').replace(',', '.')) || 0);
      const mx = Math.max(...marks);
      if (mx > 0) fichas.get(k)[key] = String(marks.indexOf(mx) + 1);
    }
    return { relatorios: [...fichas.values()], nomes };
  }
  function fromTidy(rows) {
    const h = rows[0].map((c) => String(c).trim());
    const relatorios = rows.slice(1).map((r) => Object.fromEntries(h.map((c, i) => [c, r[i] == null ? '' : String(r[i])])));
    return { relatorios, nomes: new Map() };
  }
  function build(rows) {
    const h = rows[0] ? rows[0].map((c) => String(c).trim().toLowerCase()) : [];
    const tidy = h.includes('sigla') && h.includes('relatorio') && h.includes('status');
    const { relatorios, nomes } = tidy ? fromTidy(rows) : fromRaw(rows);
    if (!relatorios.length) throw new Error('nenhuma ficha encontrada');
    relatorios.sort((a, b) => a.sigla.localeCompare(b.sigla) || Number(a.turma) - Number(b.turma) || Number(a.relatorio) - Number(b.relatorio));
    const orig = new Map((window.SV_ORIG_CURSOS ? window.SV_ORIG_CURSOS() : []).map((c) => [c.sigla, c]));
    const siglas = [...new Set(relatorios.map((r) => r.sigla))].sort();
    const cursos = siglas.map((s) => {
      const o = orig.get(s);
      const curso = nomes.get(s) || (o ? o.curso : 'Sem nome no cadastro');
      const en = o && o.curso_en && (o.curso === curso || !nomes.get(s)) ? o.curso_en : (curso === 'Sem nome no cadastro' ? 'No name on record' : curso);
      return { sigla: s, area: s.slice(0, 4), curso, curso_en: en };
    });
    return { relatorios, cursos };
  }
  window.SV_UPLOAD = {
    async load(file) {
      let rows;
      if (/\.csv$/i.test(file.name)) rows = splitCSV(await file.text());
      else {
        await ensureXLSX();
        const wb = window.XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const name = wb.SheetNames.find((n) => /sql/i.test(n)) || wb.SheetNames[0];
        rows = window.XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' });
      }
      const base = build(rows);
      window.SV_SET_BASE(base, file.name);
      return { n: base.relatorios.length };
    },
    restore() { window.SV_RESET_BASE(); },
  };
})();
