import { Injectable } from '@nestjs/common';
import { InMemoryRepository } from '../common/repository/in-memory.repository.js';
import { Emprestimo } from './entities/emprestimo.entity.js';
import { criarEmprestimosSeed } from './emprestimos.seed.js';

@Injectable()
export class EmprestimosRepository extends InMemoryRepository<Emprestimo> {
  protected override dadosIniciais(): Emprestimo[] {
    return criarEmprestimosSeed();
  }

  buscarPorProtocolo(protocolo: string): Promise<Emprestimo | null> {
    return this.encontrar((e) => e.protocolo === protocolo);
  }

  /** Quantos empréstimos existem no ano. */
  async contarPorAno(ano: number): Promise<number> {
    const doAno = await this.filtrar((e) =>
      e.protocolo.startsWith(`EMP-${ano}-`),
    );
    return doAno.length;
  }

  /** Maior número de protocolo já usado no ano (0 se não houver nenhum). */
  async maiorSequencialDoAno(ano: number): Promise<number> {
    const prefixo = `EMP-${ano}-`;
    const doAno = await this.filtrar((e) => e.protocolo.startsWith(prefixo));
    return doAno.reduce((maior, e) => {
      const numero = Number(e.protocolo.slice(prefixo.length));
      return Number.isFinite(numero) ? Math.max(maior, numero) : maior;
    }, 0);
  }
}