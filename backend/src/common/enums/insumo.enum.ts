/** Categorias de insumo (itens de consumo: acabam e precisam ser repostos). */
export enum CategoriaInsumo {
  Impressao3d = 'impressao_3d',
  Eletronica = 'eletronica',
  Papelaria = 'papelaria',
  Limpeza = 'limpeza',
  Ferragens = 'ferragens',
  Outros = 'outros',
}

/** Unidade em que o estoque do insumo é contado. */
export enum UnidadeMedida {
  Unidade = 'un',
  Caixa = 'cx',
  Pacote = 'pct',
  Rolo = 'rolo',
  Quilo = 'kg',
  Grama = 'g',
  Litro = 'l',
  Mililitro = 'ml',
  Metro = 'm',
}

/** Sentido da movimentação de estoque. */
export enum TipoMovimentacao {
  Entrada = 'entrada',
  Saida = 'saida',
}

/** Por que o estoque mudou. Cada motivo só vale para um tipo (veja MOTIVOS_POR_TIPO). */
export enum MotivoMovimentacao {
  // entradas
  Compra = 'compra',
  Doacao = 'doacao',
  AjustePositivo = 'ajuste_positivo',
  // saídas
  UsoEmAula = 'uso_em_aula',
  Perda = 'perda',
  Vencimento = 'vencimento',
  AjusteNegativo = 'ajuste_negativo',
}

export const MOTIVOS_POR_TIPO: Record<
  TipoMovimentacao,
  readonly MotivoMovimentacao[]
> = {
  [TipoMovimentacao.Entrada]: [
    MotivoMovimentacao.Compra,
    MotivoMovimentacao.Doacao,
    MotivoMovimentacao.AjustePositivo,
  ],
  [TipoMovimentacao.Saida]: [
    MotivoMovimentacao.UsoEmAula,
    MotivoMovimentacao.Perda,
    MotivoMovimentacao.Vencimento,
    MotivoMovimentacao.AjusteNegativo,
  ],
};
