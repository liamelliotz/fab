import { Injectable } from '@nestjs/common';
import { InMemoryRepository } from '../common/repository/index.js';
import type { MovimentacaoInsumo } from './entities/movimentacao-insumo.entity.js';
import { criarInsumosSeed } from './insumos.seed.js';

/**
 * Histórico de entradas e saídas de insumos. Só acréscimo: o service nunca chama
 * `atualizar` nem `remover` aqui (no banco, um gatilho impede as duas coisas).
 */
@Injectable()
export class MovimentacoesRepository extends InMemoryRepository<MovimentacaoInsumo> {
  protected override dadosIniciais(): MovimentacaoInsumo[] {
    return criarInsumosSeed().movimentacoes;
  }

  /** Movimentações de um insumo, da mais antiga para a mais recente. */
  async listarDoInsumo(insumoId: string): Promise<MovimentacaoInsumo[]> {
    const doInsumo = await this.filtrar((m) => m.insumoId === insumoId);
    return doInsumo.sort(
      (a, b) => Date.parse(a.ocorridaEm) - Date.parse(b.ocorridaEm),
    );
  }
}
