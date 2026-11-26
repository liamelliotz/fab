import { Injectable } from '@nestjs/common';
import { InMemoryRepository } from '../common/repository/index.js';
import type { Insumo } from './entities/insumo.entity.js';
import { criarInsumosSeed } from './insumos.seed.js';

/** Deixa o nome comparável: sem espaços nas pontas e em minúsculas (igual ao índice do banco). */
export function normalizarNomeInsumo(nome: string): string {
  return nome.trim().toLowerCase();
}

@Injectable()
export class InsumosRepository extends InMemoryRepository<Insumo> {
  protected override dadosIniciais(): Insumo[] {
    return criarInsumosSeed().insumos;
  }

  /**
   * Busca pelo nome, ignorando espaços nas pontas e maiúsculas/minúsculas.
   * `ignorarId` serve para a edição: o próprio insumo não conta como duplicado.
   */
  buscarPorNome(nome: string, ignorarId?: string): Promise<Insumo | null> {
    const alvo = normalizarNomeInsumo(nome);
    return this.encontrar(
      (insumo) =>
        insumo.id !== ignorarId && normalizarNomeInsumo(insumo.nome) === alvo,
    );
  }
}
