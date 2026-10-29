import { Injectable } from '@nestjs/common';
import { EmprestimosRepository } from './emprestimos.repository.js';

@Injectable()
export class EmprestimosService {
  constructor(private readonly emprestimosRepository: EmprestimosRepository) {}

  /**
   * Gera o protocolo EMP-AAAA-0001: sequencial e reiniciado a cada ano.
   * Usa o MAIOR número do ano + 1 (e não a quantidade de pedidos), para nunca
   * repetir um protocolo do seed. Com o seed até 0044, o próximo de 2026 é 0045.
   */
  async gerarProtocolo(data: Date = new Date()): Promise<string> {
    const ano = data.getFullYear();
    const proximo =
      (await this.emprestimosRepository.maiorSequencialDoAno(ano)) + 1;
    return `EMP-${ano}-${String(proximo).padStart(4, '0')}`;
  }
}