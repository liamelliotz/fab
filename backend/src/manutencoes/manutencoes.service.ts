import { Injectable, Logger } from '@nestjs/common';

/** Dados de uma avaria encontrada na devolução do balcão (card C5). */
export interface AvariaDeDevolucao {
  emprestimoId: string;
  protocolo: string;
  equipamentoId: string;
  quantidade: number;
  observacoes: string;
  registradaPorId: string;
}

export interface RegistroAvariaDeDevolucao extends AvariaDeDevolucao {
  registradaEm: string;
}

@Injectable()
export class ManutencoesService {
  private readonly logger = new Logger(ManutencoesService.name);
  private readonly avariasDeDevolucao: RegistroAvariaDeDevolucao[] = [];

  /**
   * PROVISÓRIO (C5): guarda a avaria em memória até o card B4 criar a manutenção de verdade.
   * O B4 deve substituir este método mantendo a assinatura.
   */
  registrarAvariaDeDevolucao(avaria: AvariaDeDevolucao): Promise<void> {
    this.avariasDeDevolucao.push({
      ...avaria,
      registradaEm: new Date().toISOString(),
    });
    this.logger.warn(
      `Avaria na devolução de ${avaria.protocolo} (equipamento ${avaria.equipamentoId}).`,
    );
    return Promise.resolve();
  }

  listarAvariasDeDevolucao(): readonly RegistroAvariaDeDevolucao[] {
    return this.avariasDeDevolucao;
  }
}
