import { StatusEmprestimo } from './emprestimo.model';

/**
 * Contrato do DASHBOARD.
 * Rota: GET /dashboard/resumo (qualquer usuário logado).
 * Para `admin` os números são do sistema todo; para `usuario`, só dos pedidos dele.
 */

/** Pedido exibido na lista de "pedidos recentes". */
export interface PedidoRecente {
  id: string;
  protocolo: string;
  /** Nome de quem solicitou. */
  solicitante: string;
  status: StatusEmprestimo;
  /** Momento da solicitação em ISO 8601 completo. */
  dataSolicitacao: string;
}

export interface DashboardResumo {
  /** Somente o administrador recebe a quantidade de insumos a repor. */
  insumosARepor?: number;
  solicitacoesPendentes: number;
  emprestimosAtivos: number;
  emprestimosAtrasados: number;
  /** Soma das unidades disponíveis no estoque. */
  equipamentosDisponiveis: number;
  /** Quantidade de equipamentos em manutenção. */
  equipamentosEmManutencao: number;
  /** Os pedidos mais recentes, do mais novo para o mais antigo. */
  pedidosRecentes: PedidoRecente[];
}
