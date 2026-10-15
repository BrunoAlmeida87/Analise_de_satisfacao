# Avaliação de reação dos treinamentos

Dashboard interativo das fichas de **avaliação de tipo de reação** dos treinamentos: 7.456 fichas, 77 cursos, 11 áreas e 558 turmas, extraídas da planilha *Relatórios de Satisfação Treinamentos* (aba SQL Results).

**Acesse:** https://brunoalmeida87.github.io/Analise_de_satisfacao/ (publicado a partir do branch `gh-pages`; após atualizar o `main`, rode `git push origin main:gh-pages`)

O dashboard é uma página única (`index.html`), com os dados embutidos. Não precisa de servidor: também abre direto no navegador.

**Versão offline:** `painel_offline.html` traz tudo embutido (dados, biblioteca de gráficos e leitor de Excel). Baixe o arquivo e abra com dois cliques, sem precisar de internet.

## O que tem no painel

- **Duas abas:** *Painel* (gráficos e tabelas) e *Dados* (as fichas de origem). Clique em qualquer barra, célula, ponto, linha ou card para abrir na aba Dados exatamente as fichas que formam aquele número, com resumo por curso, busca, ordenação, coluna destacada e exportação.
- **Filtros com seleção múltipla** de áreas, cursos e turmas (com busca, *Selecionar todos*, *Limpar* e *Inverter*), opção **Só com fichas preenchidas**, **Agrupar por** (área, curso, turma) e **Voltar** (desfaz o último filtro). O recorte fica salvo no endereço da página.
- **Português e inglês**, com escolha separada para os nomes dos cursos.
- **Explicações (ⓘ)** em cada indicador e coluna, blocos **Como ler** nos gráficos mais técnicos (radar, matriz de prioridades com a correlação de Pearson, funil de controle, turmas) e um dicionário com métricas, perguntas da ficha e limitações dos dados.
- **Cores configuráveis:** paleta das notas, destaque e mapa de calor em faixas fixas (limites editáveis) ou por distância da referência.
- **Visão geral**, **distância até a excelência** (ordem da ficha, ranking ou polarização), **dimensões**, **radar (teia de aranha)** por pergunta (com 2 a 6 cursos selecionados, uma linha por curso), **aprendizagem percebida**, **matriz de prioridades**, **funil de controle**, **consistência entre turmas**, **mapa de calor**, **ranking**, **participação**, **qualidade da base** e **leitura executiva**.
- **Exportações:** cada bloco exporta em PNG (alta resolução), PDF e, quando é tabela, CSV. Há ainda o **PDF completo** do painel, o CSV das fichas do recorte e Imprimir.
- **Atualizar base no navegador:** carregue a planilha exportada do banco (.xlsx, aba SQL Results) ou o CSV no mesmo formato.

## Estrutura

```
index.html                 página final (gerada por scripts/build.py)
painel_offline.html        mesma página com as bibliotecas embutidas, para usar sem internet
vendor/                    d3 7.8.5, SheetJS 0.18.5 e jsPDF 2.5.1, embutidos na versão offline
data/relatorios.csv        uma linha por ficha: curso, turma, situação e notas 1–5 das 12 perguntas
data/cursos.csv            código, área, nome original e nome em inglês de cada curso
data/traducoes_cursos.csv  nomes dos cursos em inglês (edite aqui para corrigir uma tradução)
src/markup.html            estrutura e estilos
src/i18n.js                textos em português e inglês, explicações e dicionário
src/app.js                 cálculos no navegador, gráficos, filtros, aba Dados, cores, exportações
src/shim.js, upload.js     runtime da versão independente e leitura da planilha no navegador
src/theme.css              cores e tipografia (tema claro e escuro)
scripts/prep.py            converte a planilha exportada do banco em data/*.csv
scripts/build.py           monta o index.html a partir de src/ e data/
```

## Atualizar com uma nova exportação

Pelo navegador: botão **Atualizar base** e escolha a planilha. Vale só para o navegador em que foi carregada.

Para atualizar o site para todos:

```bash
pip install pandas openpyxl
python scripts/prep.py "Relatórios de Satisfação Treinamentos.xlsx"
python scripts/build.py   # gera index.html e painel_offline.html
git add -A && git commit -m "Atualiza dados" && git push && git push origin main:gh-pages
```

Cursos novos aparecem com o nome original também em inglês até serem incluídos em `data/traducoes_cursos.csv`.

## Definições

- **Escala:** 1 Fraco · 2 Regular · 3 Bom · 4 Muito bom · 5 Ótimo.
- **Índice de satisfação:** média das perguntas de reação respondidas em cada ficha, depois a média entre as fichas.
- **% Ótimo:** parcela das respostas com nota 5.
- **Taxa de resposta:** preenchidas ÷ (preenchidas + não preenchidas). Faltosos ficam fora da conta, e respostas marcadas em fichas de faltosos são desconsideradas.
- **Influência:** correlação de Pearson entre a nota da pergunta e a média das demais perguntas da mesma ficha (calculada a partir de 10 fichas).
- **Funil de controle:** índice geral ± 1,96 e ± 3,09 desvios-padrão ÷ √n.
- **Área:** prefixo do código do curso (ex.: C.OP).
- **Faixas do mapa de calor (padrão):** média — crítico abaixo de 3,5; atenção a partir de 3,5; bom a partir de 4,0; excelente a partir de 4,5. % Ótimo — 50, 65 e 80. Ajustáveis no botão Cores.
