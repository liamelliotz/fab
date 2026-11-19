import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  StatusEmprestimo,
  TipoEventoEmprestimo,
} from '../common/enums/index.js';
import { gerarCodigo } from '../common/utils/codigo.util.js';
import { hojeIso } from '../common/utils/data.util.js';
import { EquipamentosService } from '../equipamentos/equipamentos.service.js';
import type { AvaliarEmprestimoDto } from './dto/avaliar-emprestimo.dto.js';
import type {
  Emprestimo,
  EventoEmprestimo,
} from './entities/emprestimo.entity.js';
import { EmprestimosRepository } from './emprestimos.repository.js';

@Injectable()
export class EmprestimosService {
  /** Avaliações e cancelamentos rodam um de cada vez (evita aprovar o mesmo pedido duas vezes). */
  private fila: Promise<unknown> = Promise.resolve();

  constructor(
    @Inject(EmprestimosRepository)
    private readonly emprestimosRepository: EmprestimosRepository,
    @Inject(EquipamentosService)
    private readonly equipamentosService: EquipamentosService,
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

  /** Admin aprova ou reprova um pedido pendente. Erros: 404, 409. */
  avaliar(
    id: string,
    dto: AvaliarEmprestimoDto,
    adminId: string,
  ): Promise<Emprestimo> {
    return this.serializar(async () => {
      const pedido = await this.obterOuFalhar(id);
      this.exigirPendente(pedido);
      return dto.aprovado
        ? this.aprovar(pedido, adminId)
        : this.reprovar(pedido, dto.motivo ?? '', adminId);
    });
  }

  /** O solicitante cancela o próprio pedido pendente. O 403 vem antes do 409. */
  cancelar(id: string, usuarioId: string): Promise<Emprestimo> {
    return this.serializar(async () => {
      const pedido = await this.obterOuFalhar(id);
      if (pedido.solicitanteId !== usuarioId) {
        throw new ForbiddenException(
          'Só quem solicitou o pedido pode cancelá-lo.',
        );
      }
      this.exigirPendente(pedido);
      return this.gravar(pedido.id, {
        status: StatusEmprestimo.Cancelado,
        historico: [
          ...pedido.historico,
          this.novoEvento(TipoEventoEmprestimo.Cancelado, usuarioId),
        ],
      });
    });
  }

  private async aprovar(pedido: Emprestimo, adminId: string): Promise<Emprestimo> {
    // Se faltar estoque, lança 409 aqui e nada é reservado nem alterado.
    await this.equipamentosService.reservarVarios(
      pedido.itens.map((i) => ({ id: i.equipamentoId, quantidade: i.quantidade })),
    );
    const codigoRetirada = gerarCodigo(await this.codigosEmUso());
    return this.gravar(pedido.id, {
      status: StatusEmprestimo.Aprovado,
      avaliadoPorId: adminId,
      codigoRetirada,
      historico: [
        ...pedido.historico,
        this.novoEvento(TipoEventoEmprestimo.Aprovado, adminId),
      ],
    });
  }

  private reprovar(
    pedido: Emprestimo,
    motivo: string,
    adminId: string,
  ): Promise<Emprestimo> {
    return this.gravar(pedido.id, {
      status: StatusEmprestimo.Rejeitado,
      avaliadoPorId: adminId,
      motivoRejeicao: motivo,
      historico: [
        ...pedido.historico,
        this.novoEvento(TipoEventoEmprestimo.Rejeitado, adminId, motivo),
      ],
    });
  }

  /** Códigos dos pedidos ativos (aprovados e em andamento). */
  private async codigosEmUso(): Promise<Set<string>> {
    const ativos = await this.emprestimosRepository.buscarComCodigoAtivo();
    const emUso = new Set<string>();
    for (const e of ativos) {
      if (e.codigoRetirada) emUso.add(e.codigoRetirada);
      if (e.codigoDevolucao) emUso.add(e.codigoDevolucao);
    }
    return emUso;
  }

  private exigirPendente(pedido: Emprestimo): void {
    if (pedido.status !== StatusEmprestimo.Pendente) {
      throw new ConflictException(
        `O pedido ${pedido.protocolo} não está pendente (situação: ${pedido.status}).`,
      );
    }
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

  private async obterOuFalhar(id: string): Promise<Emprestimo> {
    const pedido = await this.emprestimosRepository.buscarPorId(id);
    if (!pedido) throw new NotFoundException('Pedido não encontrado.');
    return pedido;
  }

  private async gravar(
    id: string,
    alteracoes: Partial<Emprestimo>,
  ): Promise<Emprestimo> {
    const atualizado = await this.emprestimosRepository.atualizar(id, alteracoes);
    if (!atualizado) throw new NotFoundException('Pedido não encontrado.');
    return atualizado;
  }

  private serializar<T>(operacao: () => Promise<T>): Promise<T> {
    const execucao = this.fila.then(operacao);
    this.fila = execucao.catch(() => undefined);
    return execucao;
  }
}
