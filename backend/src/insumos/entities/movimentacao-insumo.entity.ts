import {
  MotivoMovimentacao,
  TipoMovimentacao,
} from '../../common/enums/index.js';

/**
 * Entrada ou saída de um insumo. SÓ ACRÉSCIMO: uma movimentação nunca é editada nem apagada.
 * Lançou errado? Registre um ajuste (ajuste_positivo ou ajuste_negativo).
 */
export interface MovimentacaoInsumo {
  id: string;
  insumoId: string;
  tipo: TipoMovimentacao;
  /** Sempre maior que zero. O sentido vem do `tipo`. */
  quantidade: number;
  /** Saldo do insumo logo depois desta movimentação (facilita auditoria e relatórios). */
  saldoApos: number;
  motivo: MotivoMovimentacao;
  observacao?: string;
  /** Admin que registrou (vem do token, nunca do corpo da requisição). */
  responsavelId: string;
  /** Em saídas: professor que recebeu o material (opcional). */
  destinatarioId?: string;
  /** Em entradas: validade do lote recebido (AAAA-MM-DD), quando houver. */
  validadeLote?: string;
  /** Quando aconteceu (ISO 8601). Padrão: agora. Não pode ser no futuro. */
  ocorridaEm: string;
  criadoEm: string;
}
