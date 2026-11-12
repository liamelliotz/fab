import { Injectable } from '@nestjs/common';
import { InMemoryRepository } from '../common/repository/index.js';
import { EQUIPAMENTOS_SEED } from '../common/seed/index.js';
import type { Equipamento } from './entities/equipamento.entity.js';

/** Deixa o patrimônio comparável: sem espaços nas pontas e em minúsculas. */
export function normalizarPatrimonio(codigo: string): string {
  return codigo.trim().toLowerCase();
}

@Injectable()
export class EquipamentosRepository extends InMemoryRepository<Equipamento> {
  protected override dadosIniciais(): Equipamento[] {
    return EQUIPAMENTOS_SEED;
  }

  /** Busca pelo patrimônio, ignorando espaços e maiúsculas/minúsculas. */
  buscarPorCodigoPatrimonio(codigo: string): Promise<Equipamento | null> {
    const alvo = normalizarPatrimonio(codigo);
    return this.encontrar(
      (equipamento) =>
        normalizarPatrimonio(equipamento.codigoPatrimonio) === alvo,
    );
  }
}
