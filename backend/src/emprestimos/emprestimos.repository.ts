import { Injectable } from '@nestjs/common';
import { InMemoryRepository } from '../common/repository/in-memory.repository.js';
import { criarEmprestimosSeed } from './emprestimos.seed.js';
import type { Emprestimo } from './entities/emprestimo.entity.js';

@Injectable()
export class EmprestimosRepository extends InMemoryRepository<Emprestimo> {
  /** Último número de protocolo já ENTREGUE em cada ano (mesmo que o pedido ainda não esteja gravado). */
  private readonly ultimoSequencial = new Map<number, number>();

  protected override dadosIniciais(): Emprestimo[] {
    return criarEmprestimosSeed();
  }

  buscarPorProtocolo(protocolo: string): Promise<Emprestimo | null> {
    return this.encontrar((e) => e.protocolo === protocolo);
  }

  /** Maior número de protocolo gravado no ano (0 se não houver nenhum). */
  async maiorSequencialDoAno(ano: number): Promise<number> {
    const prefixo = `EMP-${ano}-`;
    const doAno = await this.filtrar((e) => e.protocolo.startsWith(prefixo));
    return doAno.reduce((maior, e) => {
      const numero = Number(e.protocolo.slice(prefixo.length));
      return Number.isFinite(numero) ? Math.max(maior, numero) : maior;
    }, 0);
  }

  /**
   * Reserva e devolve o próximo número de protocolo do ano. Nunca entrega o mesmo número duas
   * vezes, nem com dois pedidos chegando juntos: depois do `await` não há outra pausa entre
   * ler e gravar o contador.
   *
   * No PostgreSQL este método vira um UPDATE ... RETURNING na tabela `sequencias_protocolo`
   * (veja database/migrations), e a coluna `protocolo` tem UNIQUE como segunda trava.
   */
  async reservarSequencial(ano: number): Promise<number> {
    const gravado = await this.maiorSequencialDoAno(ano);
    const proximo = Math.max(gravado, this.ultimoSequencial.get(ano) ?? 0) + 1;
    this.ultimoSequencial.set(ano, proximo);
    return proximo;
  }

  override async redefinir(): Promise<void> {
    this.ultimoSequencial.clear();
    await super.redefinir();
  }
}
