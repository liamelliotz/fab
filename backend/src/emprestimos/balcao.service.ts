import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  StatusEmprestimo,
  TipoEventoEmprestimo,
} from '../common/enums/index.js';
import { gerarCodigo, normalizarCodigo } from '../common/utils/codigo.util.js';
import { hojeIso } from '../common/utils/data.util.js';
import { EquipamentosService } from '../equipamentos/equipamentos.service.js';
import { ManutencoesService } from '../manutencoes/manutencoes.service.js';
import { EmprestimosRepository } from './emprestimos.repository.js';
import type {
  Emprestimo,
  EventoEmprestimo,
} from './entities/emprestimo.entity.js';

export type TipoCodigoBalcao = 'retirada' | 'devolucao';

export interface ConsultaBalcao {
  tipo: TipoCodigoBalcao;
  emprestimo: Emprestimo;
}

export interface DadosDevolucao {
  houveAvaria?: boolean;
  observacoes?: string;
}

/** Retirada e devolução por código no balcão (card C5). Só o admin chega aqui. */
@Injectable()
export class BalcaoService {
  /** Uma operação de balcão por vez (evita usar o mesmo código duas vezes). */
  private fila: Promise<unknown> = Promise.resolve();

  constructor(
    @Inject(EmprestimosRepository)
    private readonly emprestimosRepository: EmprestimosRepository,
    @Inject(EquipamentosService)
    private readonly equipamentosService: EquipamentosService,
    @Inject(ManutencoesService)
    private readonly manutencoesService: ManutencoesService,
  ) {}

  /** Descobre de qual pedido é o código e se é de retirada ou de devolução. 404 se desconhecido. */
  async consultar(codigoBruto: string): Promise<ConsultaBalcao> {
    const codigo = normalizarCodigo(codigoBruto ?? '');
    if (codigo) {
      const ativos = await this.emprestimosRepository.buscarComCodigoAtivo();
      for (const emprestimo of ativos) {
        if (emprestimo.codigoRetirada === codigo) {
          return { tipo: 'retirada', emprestimo };
        }
        if (emprestimo.codigoDevolucao === codigo) {
          return { tipo: 'devolucao', emprestimo };
        }
      }
    }
    throw new NotFoundException('Código desconhecido.');
  }

  /** Aprovado vira em andamento; o código de retirada é apagado e nasce o de devolução. */
  retirar(codigoBruto: string, adminId: string): Promise<Emprestimo> {
    return this.serializar(async () => {
      const { tipo, emprestimo } = await this.consultar(codigoBruto);
      if (tipo !== 'retirada') {
        throw new ConflictException(
          'Este código é de devolução, não de retirada.',
        );
      }
      if (emprestimo.status !== StatusEmprestimo.Aprovado) {
        throw new ConflictException(
          `O pedido ${emprestimo.protocolo} não está aprovado (situação: ${emprestimo.status}).`,
        );
      }
      return this.gravar(emprestimo.id, {
        status: StatusEmprestimo.EmAndamento,
        dataRetiradaEfetiva: hojeIso(),
        codigoRetirada: undefined,
        codigoDevolucao: gerarCodigo(await this.codigosEmUso()),
        historico: [
          ...emprestimo.historico,
          this.novoEvento(TipoEventoEmprestimo.Retirado, adminId),
        ],
      });
    });
  }

  /**
   * Em andamento vira devolvido. Com avaria: observações obrigatórias, cada item vai para a
   * manutenção e o estoque NÃO volta. Sem avaria: cada item é liberado no estoque.
   */
  devolver(
    codigoBruto: string,
    dados: DadosDevolucao,
    adminId: string,
  ): Promise<Emprestimo> {
    return this.serializar(async () => {
      const { tipo, emprestimo } = await this.consultar(codigoBruto);
      if (tipo !== 'devolucao') {
        throw new ConflictException(
          'Este código é de retirada, não de devolução.',
        );
      }
      if (emprestimo.status !== StatusEmprestimo.EmAndamento) {
        throw new ConflictException(
          `O pedido ${emprestimo.protocolo} não está em andamento (situação: ${emprestimo.status}).`,
        );
      }

      const houveAvaria = dados.houveAvaria === true;
      const observacoes = dados.observacoes?.trim() ?? '';
      if (houveAvaria && !observacoes) {
        throw new BadRequestException(
          'Informe as observações quando houver avaria.',
        );
      }

      for (const item of emprestimo.itens) {
        if (houveAvaria) {
          await this.manutencoesService.registrarAvariaDeDevolucao({
            emprestimoId: emprestimo.id,
            protocolo: emprestimo.protocolo,
            equipamentoId: item.equipamentoId,
            quantidade: item.quantidade,
            observacoes,
            registradaPorId: adminId,
          });
        } else {
          await this.equipamentosService.liberar(
            item.equipamentoId,
            item.quantidade,
          );
        }
      }

      const historico = [...emprestimo.historico];
      if (emprestimo.transferenciaPendente) {
        historico.push(
          this.novoEvento(
            TipoEventoEmprestimo.TransferenciaCancelada,
            adminId,
            'Cancelada na devolução.',
          ),
        );
      }
      historico.push(
        this.novoEvento(
          TipoEventoEmprestimo.Devolvido,
          adminId,
          observacoes || undefined,
        ),
      );

      return this.gravar(emprestimo.id, {
        status: StatusEmprestimo.Devolvido,
        dataDevolucaoEfetiva: hojeIso(),
        codigoDevolucao: undefined,
        transferenciaPendente: undefined,
        houveAvaria,
        observacoesDevolucao: observacoes || undefined,
        historico,
      });
    });
  }

  private async codigosEmUso(): Promise<Set<string>> {
    const ativos = await this.emprestimosRepository.buscarComCodigoAtivo();
    const emUso = new Set<string>();
    for (const e of ativos) {
      if (e.codigoRetirada) emUso.add(e.codigoRetirada);
      if (e.codigoDevolucao) emUso.add(e.codigoDevolucao);
    }
    return emUso;
  }

  private novoEvento(
    tipo: TipoEventoEmprestimo,
    porId: string,
    detalhe?: string,
  ): EventoEmprestimo {
    return {
      id: randomUUID(),
      tipo,
      em: new Date().toISOString(),
      porId,
      ...(detalhe ? { detalhe } : {}),
    };
  }

  /**
   * Grava as alterações. O `atualizar()` do repositório ignora campos `undefined`, então, para
   * APAGAR um campo (código usado, transferência cancelada), o registro é regravado sem ele.
   */
  private async gravar(
    id: string,
    alteracoes: Partial<Emprestimo>,
  ): Promise<Emprestimo> {
    const apagar = Object.entries(alteracoes)
      .filter(([, valor]) => valor === undefined)
      .map(([chave]) => chave);

    if (apagar.length === 0) {
      const atualizado = await this.emprestimosRepository.atualizar(
        id,
        alteracoes,
      );
      if (!atualizado) throw new NotFoundException('Pedido não encontrado.');
      return atualizado;
    }

    const atual = await this.emprestimosRepository.buscarPorId(id);
    if (!atual) throw new NotFoundException('Pedido não encontrado.');

    const definidos = Object.fromEntries(
      Object.entries(alteracoes).filter(([, valor]) => valor !== undefined),
    );
    const novo: Record<string, unknown> = { ...atual, ...definidos, id };
    for (const chave of apagar) {
      delete novo[chave];
    }

    await this.emprestimosRepository.remover(id);
    return this.emprestimosRepository.criar(novo as unknown as Emprestimo);
  }

  private serializar<T>(operacao: () => Promise<T>): Promise<T> {
    const execucao = this.fila.then(operacao);
    this.fila = execucao.catch(() => undefined);
    return execucao;
  }
}
