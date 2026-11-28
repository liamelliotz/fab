import { UnidadeMedida } from './insumo.model';
import { UsuarioResumo } from './usuario.model';

/**
 * REQUISIÇÃO DE INSUMO: o professor pede uma quantidade PREVISTA de um material de consumo
 * (filamento, papel, jumpers...). Diferente do empréstimo, o insumo não volta: só a sobra,
 * quando houver, é devolvida ao estoque.
 *
 * pendente → aprovada (reserva + CÓDIGO/QR de retirada) → entregue no balcão (saída do estoque
 *            + CÓDIGO/QR de devolução da sobra) → sobra devolvida no balcão, ou "usou tudo"
 *          ↘ recusada (com motivo)  ↘ cancelada (pelo professor, com motivo, ou expirada pelo sistema)
 *
 * Prazos (rotina automática): a aprovada que não é retirada até o dia de uso + a tolerância das
 * regras de empréstimo expira e libera a reserva; a sobra pode voltar até DIAS_PARA_SOBRA depois
 * do dia de uso; depois disso o consumo é considerado integral e o código de devolução deixa de valer.
 */
export type StatusRequisicaoInsumo = 'pendente' | 'aprovada' | 'entregue' | 'recusada' | 'cancelada';

export type AcaoRequisicaoInsumo =
  | 'solicitada'
  | 'aprovada'
  | 'recusada'
  | 'cancelada'
  | 'entregue'
  | 'sobra_devolvida'
  /** Não foi retirada no prazo: o sistema cancelou e liberou a reserva. */
  | 'expirada'
  /** Fechada sem sobra: o professor usou tudo, ou o prazo para devolver a sobra terminou. */
  | 'encerrada'
  /** Quantidade buscada no local de guarda e deixada pronta no balcão. */
  | 'separada'
  /** Sobra (ou separação desfeita) levada de volta ao local de guarda. */
  | 'guardada';

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
  /** Sobra devolvida depois do uso (consumo real = entregue − sobra). 0 = usou tudo. */
  quantidadeDevolvida?: number;
  /** Código de 6 caracteres (e QR) para retirar no balcão. Existe só enquanto está aprovada. */
  codigoRetirada?: string;
  /** Código (e QR) para devolver a sobra no balcão. Existe da entrega até a sobra ser registrada. */
  codigoDevolucao?: string;
  /** Último dia para devolver a sobra (AAAA-MM-DD). */
  prazoSobra?: string;
  /** SEPARAÇÃO: a quantidade aprovada já foi buscada no local de guarda e está pronta no balcão. */
  separadaEm?: string;
  separadaPor?: UsuarioResumo;
  /** A GUARDAR: quantidade no balcão esperando voltar ao local de guarda (sobra, ou separação desfeita). */
  aGuardar?: number;
  guardadaEm?: string;
  guardadaPor?: UsuarioResumo;
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
