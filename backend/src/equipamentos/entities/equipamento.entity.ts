import {
  CategoriaEquipamento,
  StatusEquipamento,
} from '../../common/enums/index.js';

/**
 * Equipamento do acervo (item que é emprestado e devolvido).
 * Campos e nomes IGUAIS aos do front (core/models/equipamento.model.ts).
 *
 * Não existe campo `ativo`: desativar é mudar o `status` para `inativo`
 * (PATCH /equipamentos/:id/ativo faz essa troca).
 */
export interface Equipamento {
  id: string;
  nome: string;
  descricao: string;
  /** Plaqueta de patrimônio. Única, sem diferenciar maiúsculas nem espaços nas pontas. */
  codigoPatrimonio: string;
  categoria: CategoriaEquipamento;
  status: StatusEquipamento;
  /** Onde o item fica guardado (ex.: "Armário de TI - Prateleira 1"). */
  localizacao: string;
  fotoUrl?: string;
  /** Se verdadeiro, só pede (ou recebe por transferência) quem tem a habilitação. */
  requerTreinamento: boolean;
  /** Prazo máximo do empréstimo, em dias (1 a 365), da retirada à devolução. */
  prazoMaximoDias: number;
  quantidadeTotal: number;
  /** Sempre entre 0 e quantidadeTotal. */
  quantidadeDisponivel: number;
  /** Momentos em ISO 8601 completo. */
  criadoEm: string;
  atualizadoEm?: string;
}
