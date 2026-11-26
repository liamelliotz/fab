import type { Insumo } from './entities/insumo.entity.js';

/** O que a API devolve de um insumo: a entidade mais o campo calculado `estoqueBaixo`. */
export type InsumoResposta = Insumo & { estoqueBaixo: boolean };

/**
 * Regra de estoque baixo (contrato, regra 25): `quantidadeAtual <= estoqueMinimo` em insumo
 * ATIVO. Insumo desativado nunca aparece como "a repor".
 */
export function estaComEstoqueBaixo(
  insumo: Pick<Insumo, 'ativo' | 'quantidadeAtual' | 'estoqueMinimo'>,
): boolean {
  return insumo.ativo && insumo.quantidadeAtual <= insumo.estoqueMinimo;
}

export function paraResposta(insumo: Insumo): InsumoResposta {
  return { ...insumo, estoqueBaixo: estaComEstoqueBaixo(insumo) };
}
