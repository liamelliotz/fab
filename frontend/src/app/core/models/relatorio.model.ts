/**
 * Contrato do RELATÓRIO DE UTILIZAÇÃO.
 * Rota: GET /relatorios/utilizacao?dataInicio=AAAA-MM-DD&dataFim=AAAA-MM-DD (somente admin).
 * A exportação em CSV continua sendo feita no front.
 */

/** Parâmetros de consulta do relatório (datas AAAA-MM-DD; início não pode ser depois do fim). */
export interface FiltroRelatorioDTO {
  dataInicio: string;
  dataFim: string;
}

/** Uso de um equipamento no período. */
export interface UtilizacaoEquipamento {
  equipamentoId: string;
  /** Nome do equipamento. */
  equipamento: string;
  codigoPatrimonio: string;
  /** Quantidade de pedidos que incluíram o equipamento. */
  totalPedidos: number;
  /** Soma das unidades emprestadas. */
  totalUnidades: number;
}

/** Resposta do relatório. Período sem dados devolve `itens: []`, e não erro. */
export interface RelatorioUtilizacao {
  dataInicio: string;
  dataFim: string;
  itens: UtilizacaoEquipamento[];
  totalPedidos: number;
  totalUnidades: number;
}
