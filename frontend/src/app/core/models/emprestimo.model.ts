/**
 * @file emprestimo.model.ts
 * @description Contratos de dados, ciclos de aprovação e rastreamento de pedidos
 * de empréstimo e devolução de materiais e equipamentos.
 */

import { UsuarioResumo } from './usuario.model';
import { Equipamento } from './equipamento.model';

/**
 * Ciclo de vida completo da solicitação de empréstimo.
 *
 * - `pendente`: Pedido registrado pelo solicitante aguardando triagem do laboratório.
 * - `aprovado`: Solicitação avaliada e autorizada; reserva alocada aguardando retirada.
 * - `rejeitado`: Pedido recusado pela administração mediante justificativa formal.
 * - `em_andamento`: Materiais retirados pelo solicitante e em uso ativo.
 * - `devolvido`: Itens conferidos, devolvidos ao laboratório e acervo restabelecido.
 * - `atrasado`: Prazo limite de devolução expirado sem entrega confirmada.
 * - `cancelado`: Cancelamento efetuado antes da retirada (pelo solicitante ou sistema).
 */
export type StatusEmprestimo =
  'pendente' | 'aprovado' | 'rejeitado' | 'em_andamento' | 'devolvido' | 'atrasado' | 'cancelado';

/**
 * Especificação de cada item ou material contido dentro de um pedido de empréstimo.
 */
export interface ItemEmprestimo {
  /** Identificador único do equipamento vinculado */
  equipamentoId: string;

  /**
   * Objeto com detalhes do equipamento.
   * Populado pela API em respostas de consulta detalhada para alimentar a tela.
   */
  equipamento?: Equipamento;

  /** Número de unidades solicitadas deste item específico */
  quantidade: number;

  /** Apontamentos prévios sobre acessórios necessários ou estado inicial do item */
  observacoes?: string;
}

/**
 * Representação completa do registro de Empréstimo na aplicação.
 */
export interface Emprestimo {
  /** Identificador primário do registro (UUID) */
  id: string;

  /** Código alfanumérico amigável de rastreio para o solicitante (ex.: "EMP-2026-0042") */
  protocolo: string;

  /** Dados resumidos do usuário solicitante responsável */
  solicitante: UsuarioResumo;

  /** Lista contendo um ou mais equipamentos requeridos no mesmo pedido */
  itens: ItemEmprestimo[];

  /** Estado corrente de tramitação do empréstimo */
  status: StatusEmprestimo;

  /** Finalidade do uso (ex.: "Montagem de circuito para o projeto integrador de robótica") */
  justificativa: string;

  /** Timestamp de envio do pedido pelo formulário (formato ISO 8601) */
  dataSolicitacao: string;

  /** Data/hora acordada para retirada física no balcão do laboratório */
  dataPrevistaRetirada: string;

  /** Data/hora limite para restituição dos equipamentos ao laboratório */
  dataPrevistaDevolucao: string;

  /** Data/hora em que a devolução e conferência física foram homologadas */
  dataDevolucaoEfetiva?: string;

  /** Dados do administrador ou laboratorista que avaliou a solicitação */
  responsavelAprovacao?: UsuarioResumo;

  /** Parecer obrigatório preenchido pelo gestor em caso de reprovação */
  motivoRejeicao?: string;

  /** Checklist ou registro de avarias/ressalvas anotadas na devolução */
  observacoesDevolucao?: string;
}

/**
 * Payload para envio de uma nova solicitação pelo usuário final.
 */
export interface SolicitarEmprestimoDTO {
  /** Array com os IDs dos equipamentos e suas respectivas quantidades */
  itens: {
    equipamentoId: string;
    quantidade: number;
    observacoes?: string;
  }[];

  /** Descrição do projeto ou aula onde os materiais serão empregados */
  justificativa: string;

  /** Data agendada para retirada (ISO 8601: `YYYY-MM-DDTHH:mm:ss.sssZ`) */
  dataPrevistaRetirada: string;

  /** Data programada para entrega (ISO 8601: `YYYY-MM-DDTHH:mm:ss.sssZ`) */
  dataPrevistaDevolucao: string;
}

/**
 * Payload utilizado por gestores para aprovar ou reprovar uma solicitação em triagem.
 */
export interface AvaliarEmprestimoDTO {
  /** Decisão tomada: `true` para aprovar e reservar, `false` para recusar */
  aprovado: boolean;

  /** Justificativa formal da decisão (obrigatória caso `aprovado` seja falso) */
  motivo?: string;
}

/**
 * Payload enviado na baixa patrimonial e recebimento dos itens no laboratório.
 */
export interface RegistrarDevolucaoDTO {
  /** Data/hora exata do recebimento no balcão */
  dataDevolucao: string;

  /** Relato de integridade física dos itens ou pendências de cabos/acessórios */
  observacoes?: string;

  /** Marcador para indicar necessidade de abertura de chamado de manutenção corretiva */
  houveAvaria: boolean;
}

/**
 * Parâmetros de consulta e filtros para listagens administrativas e históricas.
 */
export interface FiltroEmprestimoDTO {
  /** Filtragem por estágio do ciclo de vida */
  status?: StatusEmprestimo;

  /** Filtragem de pedidos por determinado usuário */
  solicitanteId?: string;

  /** Data de solicitação mínima para consulta por período */
  dataInicio?: string;

  /** Data de solicitação máxima para consulta por período */
  dataFim?: string;

  /** Flag para destacar pedidos com prazo estourado para cobrança */
  atrasadosApenas?: boolean;
}