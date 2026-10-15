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
markup = MARKUP
rel = (DATA / 'relatorios.csv').read_text(encoding='utf-8')
cur = (DATA / 'cursos.csv').read_text(encoding='utf-8')
assert '</script' not in rel + cur
js = {n: (SRC / f'{n}.js').read_text(encoding='utf-8') for n in ('shim', 'calcs', 'i18n', 'upload', 'app')}
app = js['app']

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
{js['i18n']}
</script>
<script>
{js['upload']}
</script>
<script>
{app}
</script>
</body>
</html>
'''
(ROOT / 'index.html').write_text(page, encoding='utf-8')
print(f'index.html: {len(page.encode()) / 1024:.0f} KB')

# Página para o dashboard publicado no Claude (sem runtime próprio nem leitor de planilha)
artifact = MARKUP + '\n<script>\n' + js['calcs'] + '\n</script>\n<script>\n' + js['i18n'] + '\n</script>\n<script>\n' + js['app'] + '\n</script>\n'
(ROOT / 'build').mkdir(exist_ok=True)
(ROOT / 'build' / 'artifact_page.html').write_text(artifact, encoding='utf-8')
print(f'build/artifact_page.html: {len(artifact.encode()) / 1024:.0f} KB')
