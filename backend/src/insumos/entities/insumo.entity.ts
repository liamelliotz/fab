import { CategoriaInsumo, UnidadeMedida } from '../../common/enums/index.js';

/**
 * Insumo: item de CONSUMO. Sai do estoque e não volta (filamento, solda, papel).
 * É diferente de Equipamento, que é emprestado e devolvido.
 *
 * O saldo (`quantidadeAtual`) só muda por MOVIMENTAÇÃO (entrada ou saída). Nenhuma rota
 * edita o saldo direto, e ele nunca fica negativo.
 */
export interface Insumo {
  id: string;
  /** Único, sem diferenciar maiúsculas nem espaços nas pontas. */
  nome: string;
  descricao?: string;
  categoria: CategoriaInsumo;
  unidadeMedida: UnidadeMedida;
  /** Saldo atual. Aceita até 3 casas decimais (ex.: 0,250 kg). Nunca negativo. */
  quantidadeAtual: number;
  /** Quando quantidadeAtual <= estoqueMinimo, o item entra na lista "a repor". */
  estoqueMinimo: number;
  /** Nome do fornecedor habitual (texto livre). */
  fornecedor?: string;
  /** Validade mais próxima entre os lotes em estoque (AAAA-MM-DD). Vazio se não vence. */
  validade?: string;
  localizacao?: string;
  /** Insumo desativado não aceita movimentação e some das listas comuns. */
  ativo: boolean;
  criadoEm: string;
  atualizadoEm?: string;
}
