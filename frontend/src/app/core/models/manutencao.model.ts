/**
 * Contrato de MANUTENÇÃO (avarias e consertos de equipamentos).
 * Rotas: GET/POST /manutencoes e PATCH /manutencoes/:id (somente admin).
 * Datas sempre no formato AAAA-MM-DD; ids sempre em texto.
 */

/**
 * - `avariado`: item danificado, ainda sem conserto iniciado.
 * - `em_assistencia`: item enviado para conserto.
 * - `concluido`: conserto finalizado (a unidade volta ao estoque).
 */
export type StatusManutencao = 'avariado' | 'em_assistencia' | 'concluido';

export interface Manutencao {
  id: string;
  equipamentoId: string;
  /** Nome do equipamento (vem junto na resposta para exibir na tabela). */
  equipamento: string;
  /** Código patrimonial do equipamento. */
  codigoPatrimonio: string;
  /** Descrição do problema. */
  descricao: string;
  /** Empréstimo em que a avaria foi registrada (quando veio de uma devolução). */
  emprestimoId?: string;
  /** Nome da assistência técnica, quando houver. */
  assistencia?: string;
  status: StatusManutencao;
  dataRegistro: string;
  dataConclusao?: string;
}

/** Corpo do POST /manutencoes. */
export interface RegistrarManutencaoDTO {
  equipamentoId: string;
  descricao: string;
  emprestimoId?: string;
  assistencia?: string;
}

/** Corpo do PATCH /manutencoes/:id. */
export interface AtualizarManutencaoDTO {
  status?: StatusManutencao;
  descricao?: string;
  assistencia?: string;
}
