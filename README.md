# Avaliação de reação dos treinamentos

Dashboard interativo das fichas de **avaliação de tipo de reação** dos treinamentos: 7.456 fichas, 77 cursos, 11 áreas e 558 turmas, extraídas da planilha *Relatórios de Satisfação Treinamentos* (aba SQL Results).

**Acesse:** https://brunoalmeida87.github.io/Analise_de_satisfacao/ (publicado a partir do branch `gh-pages`; após atualizar o `main`, rode `git push origin main:gh-pages`)

O dashboard é uma página única (`index.html`), com os dados embutidos. Não precisa de servidor: também abre direto no navegador.

## O que tem no painel

- **Português e inglês**, com escolha separada para os nomes dos cursos (originais ou em inglês).
- **Filtros** por área, curso e turma, além de uma base mínima de fichas para as comparações. O recorte fica salvo no endereço da página, então um link copiado abre no mesmo filtro.
- **Navegação por seções** fixa no topo e **explicações (ⓘ)** em cada indicador e coluna, além de um dicionário com as métricas, as perguntas da ficha e o que os dados não permitem afirmar.
- **Cores configuráveis** (botão Cores): paleta das notas, cor de destaque e o mapa de calor em **faixas fixas** (crítico, atenção, bom, excelente, com limites editáveis) ou por **distância da referência**. As escolhas ficam salvas no navegador.
- **Visão geral:** índice de satisfação, % de respostas "Ótimo", fichas 100% Ótimo (efeito teto), taxa de resposta e ganho de conhecimento.
- **Distância até a excelência:** as 10 perguntas, em ordem da ficha, ranking ou polarização (desvio-padrão), mais o resumo por dimensão.
- **Aprendizagem percebida:** matriz 5×5 do conhecimento antes × após o curso.
- **Diagnóstico:** matriz de prioridades (excelência × influência) e funil de controle dos cursos (limites de 95% e 99,8%).
- **Consistência entre turmas:** amplitude entre turmas de cada curso e, com um curso selecionado, o funil das turmas em torno da média do curso.
- **Comparativo:** mapa de calor por pergunta (média ou % Ótimo) e ranking ordenável com busca.
- **Coleta e participação:** situação das fichas e auditoria da base (respostas em branco, fichas parciais, faltosos com respostas, cursos sem nome ou sem fichas, turmas pequenas, efeito teto).
- **Leitura executiva:** pontos fortes, de atenção e próximos passos, gerados a partir dos números do recorte, com botão para copiar o texto.
- **Exportações:** PNG em alta resolução de cada gráfico, tabela e bloco; CSV das tabelas e das fichas do recorte; Imprimir / PDF.
- **Atualizar base no navegador:** carregue a planilha exportada do banco (.xlsx, aba SQL Results) ou o CSV no mesmo formato. A conversão é feita localmente e a base fica salva no navegador até você restaurar a original.

## Estrutura

```
index.html                 página final (gerada por scripts/build.py)
data/relatorios.csv        uma linha por ficha: curso, turma, situação e notas 1–5 das 12 perguntas
data/cursos.csv            código, área, nome original e nome em inglês de cada curso
data/traducoes_cursos.csv  nomes dos cursos em inglês (edite aqui para corrigir uma tradução)
src/markup.html            estrutura e estilos
src/calcs.js               cálculos por recorte (geral, área, curso, turma)
src/i18n.js                textos em português e inglês, explicações e dicionário
src/app.js                 gráficos, filtros, cores, exportações
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
python scripts/build.py
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
