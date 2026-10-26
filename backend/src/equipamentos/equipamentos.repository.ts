
import { Injectable } from '@nestjs/common';
import { InMemoryRepository } from '../common/repository/index.js';
import { EQUIPAMENTOS_SEED } from '../common/seed/index.js';
import type { Equipamento } from './entities/equipamento.entity.js';

@Injectable()
export class EquipamentosRepository extends InMemoryRepository<Equipamento> {
  // Carrega os equipamentos iniciais
  protected override dadosIniciais(): Equipamento[] {
    return EQUIPAMENTOS_SEED;
  }

  // Busca patrimônio ignorando espaços e maiúsculas/minúsculas
  buscarPorPatrimonio(
    patrimonio: string,
  ): Promise<Equipamento | null> {
    const alvo = patrimonio.trim().toLowerCase();

    return this.encontrar(
      (equipamento) =>
        equipamento.patrimonio.trim().toLowerCase() === alvo,
    );
  }
}
