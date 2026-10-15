# Avaliação de reação dos treinamentos

Dashboard interativo das fichas de **avaliação de tipo de reação** dos treinamentos: 7.456 fichas, 77 cursos, 11 áreas e 558 turmas, extraídas da planilha *Relatórios de Satisfação Treinamentos* (aba SQL Results).

**Acesse:** https://brunoalmeida87.github.io/Analise_de_satisfacao/ (publicado a partir do branch `gh-pages`; após atualizar o `main`, rode `git push origin main:gh-pages`)

O dashboard é uma página única (`index.html`), com os dados embutidos. Não precisa de servidor: também abre direto no navegador.

## O que tem no painel

- **Filtros** por área, curso e turma, além de uma base mínima de fichas para as comparações. O recorte fica salvo no endereço da página, então um link copiado abre no mesmo filtro.
- **Visão geral:** índice de satisfação, % de respostas "Ótimo", fichas 100% Ótimo (efeito teto), taxa de resposta e ganho de conhecimento.
- **Distância até a excelência:** as 10 perguntas da ficha, com o eixo ancorado na fronteira do "Ótimo", mais um resumo por dimensão (Programa e metodologia, Organização, Instrutor).
- **Aprendizagem percebida:** matriz 5×5 do conhecimento antes × após o curso.
- **Diagnóstico:** matriz de prioridades (excelência × influência) e funil de controle dos cursos (limites de 95% e 99,8%).
- **Comparativo:** mapa de calor por pergunta (média ou % Ótimo) e ranking ordenável com busca.
- **Coleta e participação:** situação das fichas (preenchidas, não preenchidas, faltosos) e indicadores de qualidade da base.
- **Leitura executiva:** pontos fortes, de atenção e próximos passos, gerados a partir dos números do recorte.
- **Botão PNG** em cada gráfico, tabela e bloco: salva a imagem em até 3× a resolução da tela, com as tabelas completas.

## Estrutura

```
index.html            página final (gerada)
data/relatorios.csv   uma linha por ficha: curso, turma, situação e notas 1–5 das 12 perguntas
data/cursos.csv       código, área e nome de cada curso
src/                  código-fonte: marcação/estilos, cálculos, gráficos e o mini-runtime
scripts/prep.py       converte a planilha exportada do banco em data/*.csv
scripts/build.py      monta o index.html a partir de src/ e data/
```

## Atualizar com uma nova exportação

```bash
pip install pandas openpyxl
python scripts/prep.py "Relatórios de Satisfação Treinamentos.xlsx"
python scripts/build.py
git add -A && git commit -m "Atualiza dados" && git push
```

## Definições

- **Escala:** 1 Fraco · 2 Regular · 3 Bom · 4 Muito bom · 5 Ótimo.
- **Índice de satisfação:** média das perguntas de reação respondidas em cada ficha, depois a média entre as fichas.
- **% Ótimo:** parcela das respostas com nota 5.
- **Taxa de resposta:** preenchidas ÷ (preenchidas + não preenchidas). Faltosos ficam fora da conta, e respostas marcadas em fichas de faltosos são desconsideradas.
- **Influência:** correlação de Pearson entre a nota da pergunta e a média das demais perguntas da mesma ficha (calculada a partir de 10 fichas).
- **Funil de controle:** índice geral ± 1,96 e ± 3,09 desvios-padrão ÷ √n.
- **Área:** prefixo do código do curso (ex.: C.OP).
