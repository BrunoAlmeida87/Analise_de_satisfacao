"""Gera index.html (página única, sem servidor) a partir de src/ e data/.

Uso: python scripts/build.py
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC, DATA = ROOT / 'src', ROOT / 'data'

TOKENS = (SRC / 'theme.css').read_text(encoding='utf-8')
MARKUP = (SRC / 'markup.html').read_text(encoding='utf-8')
FONTE = '''
  <footer class="sv-foot" id="fonte">
    <p><b>Fonte.</b> Planilha "Relatórios de Satisfação Treinamentos" (extração SQL Results), convertida para uma linha por ficha. Os dados estão embutidos nesta página e também em <code>data/relatorios.csv</code> e <code>data/cursos.csv</code>. Os filtros ficam no endereço da página: um link copiado abre no mesmo recorte.</p>
  </footer>
</div>'''
head, tail = MARKUP.rsplit('</div>', 1)
markup = head + FONTE + tail
rel = (DATA / 'relatorios.csv').read_text(encoding='utf-8')
cur = (DATA / 'cursos.csv').read_text(encoding='utf-8')
assert '</script' not in rel + cur
js = {n: (SRC / f'{n}.js').read_text(encoding='utf-8') for n in ('shim', 'calcs', 'app')}
app = js['app'].replace(
    "      if (!done) preview(blob, fname, node);",
    "      if (!done && window.SV_STANDALONE) { const u = URL.createObjectURL(blob); const lk = document.createElement('a'); lk.href = u; lk.download = fname; document.body.appendChild(lk); lk.click(); lk.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); done = true; }\n      if (!done) preview(blob, fname, node);",
)
assert app != js['app']

page = f'''<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Avaliação de Reação dos Treinamentos</title>
<meta name="description" content="Dashboard das fichas de avaliação de reação dos treinamentos: satisfação por pergunta, aprendizagem percebida, diagnóstico por curso e turma, participação e qualidade da base.">
<style>
{TOKENS}
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js"></script>
</head>
<body>
<div id="dash-root">
<button class="sv-btn sv-theme" id="sv-theme" type="button" aria-label="Alternar tema claro/escuro">◐ Tema</button>
{markup}
</div>
<script type="text/csv" data-dataset="relatorios">
{rel}</script>
<script type="text/csv" data-dataset="cursos">
{cur}</script>
<script>window.SV_STANDALONE = true;
{js['shim']}</script>
<script>
{js['calcs']}
</script>
<script>
{app}
</script>
<script>
(() => {{
  document.getElementById('sv-theme').addEventListener('click', () => {{
    const r = document.documentElement;
    const dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    r.dataset.theme = dark ? 'light' : 'dark';
    window.dash.setParams({{}});
  }});
}})();
</script>
</body>
</html>
'''
(ROOT / 'index.html').write_text(page, encoding='utf-8')
print(f'index.html: {len(page.encode()) / 1024:.0f} KB')
