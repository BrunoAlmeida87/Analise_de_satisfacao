"""Converte a planilha exportada do banco (aba SQL Results, uma linha por pergunta)
em data/relatorios.csv (uma linha por ficha) e data/cursos.csv.

Uso: python scripts/prep.py "Relatórios de Satisfação Treinamentos.xlsx"
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
ITENS = {
    'OBJETIVOS ATINGIDOS': 'objetivos',
    'EQUILIBRIO ENTRE TEORIA E PRATICA': 'teoria_pratica',
    'ADEQUAÇÃO DO MATERIAL DIDÁTICO AO PROGRAMA': 'material',
    'PONTUALIDADE': 'pontualidade',
    'INSTALAÇÕES': 'instalacoes',
    'APOIO ADMINISTRATATIVO': 'apoio_adm',
    'RECURSOS AUDIOVISUAIS': 'audiovisuais',
    'DOMÍNIO DO ASSUNTO': 'dominio',
    'CLAREZA E OBJETIVIDADE NA EXPOSIÇÃO DO ASSUNTO': 'clareza',
    'CAPACIDADE DE ESCLARECER DÚVIDAS': 'duvidas',
    'ANTES DO CURSO': 'conhec_antes',
    'APÓS O CURSO': 'conhec_apos',
}
STATUS = {'Relatório preenchido': 'Preenchido', 'Relatório não preenchido': 'Não preenchido', 'Aluno Faltoso': 'Faltoso'}


def main(xlsx: str) -> None:
    df = pd.read_excel(xlsx)
    df.columns = ['sigla', 'curso', 'turma', 'rel', 'status', 'cat', 'item', 'f', 'r', 'b', 'mb', 'o']
    df['k'] = df['item'].map(ITENS)
    marcas = df[['f', 'r', 'b', 'mb', 'o']].fillna(0).values
    df['nota'] = np.where(marcas.sum(1) > 0, marcas.argmax(1) + 1, np.nan)  # 1 Fraco ... 5 Ótimo
    df['relatorio'] = df['rel'].str.extract(r'(\d+)').astype(int)

    base = df.drop_duplicates(['sigla', 'turma', 'relatorio'])[['sigla', 'turma', 'relatorio', 'status']].copy()
    base['status'] = base['status'].map(STATUS)
    notas = df[df.k.notna()].pivot_table(index=['sigla', 'turma', 'relatorio'], columns='k', values='nota', aggfunc='first')
    out = base.merge(notas.reset_index(), on=['sigla', 'turma', 'relatorio'], how='left')
    cols = list(ITENS.values())
    out = out[['sigla', 'turma', 'relatorio', 'status'] + cols].sort_values(['sigla', 'turma', 'relatorio'])
    out.loc[out.status != 'Preenchido', cols] = np.nan  # respostas em fichas de faltosos não entram
    for c in cols:
        out[c] = out[c].astype('Int64')
    (ROOT / 'data').mkdir(exist_ok=True)
    out.to_csv(ROOT / 'data' / 'relatorios.csv', index=False)

    cursos = df.groupby('sigla').curso.first().reset_index()
    cursos['area'] = cursos.sigla.str[:4]
    cursos['curso'] = cursos.curso.fillna('').str.replace(r'\s+', ' ', regex=True).str.strip()
    cursos['curso'] = cursos.curso.where(cursos.curso != '', 'Sem nome no cadastro')
    cursos[['sigla', 'area', 'curso']].to_csv(ROOT / 'data' / 'cursos.csv', index=False)
    print(f'{len(out)} fichas ({(out.status == "Preenchido").sum()} preenchidas), {len(cursos)} cursos')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
