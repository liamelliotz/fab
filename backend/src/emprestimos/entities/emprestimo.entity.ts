import {
  StatusEmprestimo,
  TipoEventoEmprestimo,
} from '../../common/enums/index.js';

/**
 * O QUE FICA GRAVADO de um pedido de empréstimo (memória hoje, PostgreSQL depois).
 *
 * Aqui só existem IDS de usuários e de equipamentos. A resposta da API (o `Emprestimo` do
 * front, em core/models/emprestimo.model.ts) troca esses ids por objetos resumidos:
 *   solicitanteId → solicitante, responsavelId → responsavel, avaliadoPorId → responsavelAprovacao,
 *   evento.porId → evento.por, item.equipamentoId → item.equipamento.
 * Essa montagem é feita no service de empréstimos (card C2), nunca no repositório.
 *
 * Datas de calendário: AAAA-MM-DD. Momentos (dataSolicitacao, evento.em): ISO 8601 completo.
 */
export interface ItemEmprestimo {
  equipamentoId: string;
  quantidade: number;
  observacoes?: string;
}

/** Um registro da linha do tempo. SÓ ACRÉSCIMO: nunca é editado nem apagado. */
export interface EventoEmprestimo {
  id: string;
  tipo: TipoEventoEmprestimo;
  /** Momento do acontecimento (ISO 8601 completo). */
  em: string;
  /** Id de quem executou a ação. */
  porId: string;
  /** Texto livre: motivo, observação, para quem foi transferido etc. */
  detalhe?: string;
}

/** Transferência aguardando a resposta do destinatário (no máximo uma por pedido). */
export interface TransferenciaPendente {
  deId: string;
  paraId: string;
  motivo: string;
  solicitadaEm: string;
}

export interface Emprestimo {
  id: string;
  /** EMP-AAAA-0001, único. */
  protocolo: string;
  /** Quem abriu o pedido (nunca muda). */
  solicitanteId: string;
  /** Quem está com o material agora. Começa igual ao solicitante; muda a cada transferência aceita. */
  responsavelId: string;
  itens: ItemEmprestimo[];
  justificativa: string;
  /** Nunca `atrasado`: esse é calculado na leitura (statusParaResposta). */
  status: Exclude<StatusEmprestimo, StatusEmprestimo.Atrasado>;
  dataSolicitacao: string;
  dataPrevistaRetirada: string;
  dataPrevistaDevolucao: string;
  dataRetiradaEfetiva?: string;
  dataDevolucaoEfetiva?: string;
  /** Admin que aprovou ou reprovou. */
  avaliadoPorId?: string;
  motivoRejeicao?: string;
  /** Existe só entre a aprovação e a retirada. */
  codigoRetirada?: string;
  /** Existe só enquanto o pedido está em andamento; muda a cada transferência aceita. */
  codigoDevolucao?: string;
  transferenciaPendente?: TransferenciaPendente;
  houveAvaria?: boolean;
  observacoesDevolucao?: string;
  historico: EventoEmprestimo[];
}
