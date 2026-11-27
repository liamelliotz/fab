import { UnidadeMedida } from './insumo.model';
import { UsuarioResumo } from './usuario.model';

/**
 * REQUISIÇÃO DE INSUMO: o professor pede uma quantidade PREVISTA de um material de consumo
 * (filamento, papel, jumpers...). Diferente do empréstimo, o insumo não volta: só a sobra,
 * quando houver, é devolvida ao estoque.
 *
 * pendente → aprovada (quantidade reservada) → entregue (saída do estoque) → [sobra devolvida]
 *          ↘ recusada (com motivo)      ↘ cancelada (pelo professor, com motivo)
 */
export type StatusRequisicaoInsumo = 'pendente' | 'aprovada' | 'entregue' | 'recusada' | 'cancelada';

export type AcaoRequisicaoInsumo =
  | 'solicitada'
  | 'aprovada'
  | 'recusada'
  | 'cancelada'
  | 'entregue'
  | 'sobra_devolvida';

/** Linha do histórico da requisição. Só cresce: nada é editado nem apagado. */
export interface EventoRequisicaoInsumo {
  acao: AcaoRequisicaoInsumo;
  por: UsuarioResumo;
  em: string;
  detalhe?: string;
}

export interface RequisicaoInsumo {
  id: string;
  /** REQ-AAAA-NNNN */
  protocolo: string;
  insumo: { id: string; nome: string; unidadeMedida: UnidadeMedida };
  solicitante: UsuarioResumo;
  /** Quantidade prevista para o uso, informada pelo professor. */
  quantidade: number;
  /** Quantidade que de fato saiu do estoque no balcão. */
  quantidadeEntregue?: number;
  /** Sobra devolvida depois do uso (consumo real = entregue − sobra). */
  quantidadeDevolvida?: number;
  /** Dia em que o insumo será usado (AAAA-MM-DD). */
  dataUso: string;
  /** Sala ou laboratório onde será usado (alimenta o mapa e a auditoria). */
  localId: string;
  turma?: string;
  /** Aula, projeto ou atividade. Obrigatória. */
  finalidade: string;
  status: StatusRequisicaoInsumo;
  /** Motivo da recusa ou do cancelamento. */
  motivo?: string;
  criadaEm: string;
  historico: EventoRequisicaoInsumo[];
}

export interface NovaRequisicaoInsumo {
  insumoId: string;
  quantidade: number;
  dataUso: string;
  localId: string;
  turma?: string;
  finalidade: string;
}
