import { Inject, Injectable } from '@nestjs/common';
import { hojeIso } from '../common/utils/data.util.js';
import { EmprestimosRepository } from './emprestimos.repository.js';

@Injectable()
export class EmprestimosService {
  constructor(
    @Inject(EmprestimosRepository)
    private readonly emprestimosRepository: EmprestimosRepository,
  ) {}

  /**
   * Gera o protocolo EMP-AAAA-0001: sequencial e reiniciado a cada ano.
   * O ano é o da ESCOLA (APP_TIMEZONE), e cada chamada recebe um número diferente,
   * mesmo com pedidos simultâneos. Com o seed até 0045, o próximo de 2026 é 0046.
   */
  async gerarProtocolo(hoje: string = hojeIso()): Promise<string> {
    const ano = Number(hoje.slice(0, 4));
    const proximo = await this.emprestimosRepository.reservarSequencial(ano);
    return `EMP-${ano}-${String(proximo).padStart(4, '0')}`;
  }
}
