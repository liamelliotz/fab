import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { montarPagina, type RespostaPaginada } from '../common/dto/index.js';
import { Perfil, StatusEquipamento } from '../common/enums/index.js';
import type { FiltroEquipamentoDto } from './dto/filtro-equipamento.dto.js';
import type { Equipamento } from './entities/equipamento.entity.js';
import { EquipamentosRepository } from './equipamentos.repository.js';

/** Status que só a coordenação enxerga (o catálogo do professor não mostra). */
const STATUS_OCULTOS_DO_CATALOGO: readonly StatusEquipamento[] = [
  StatusEquipamento.Inativo,
  StatusEquipamento.Descartado,
];

/** Um item de `reservarVarios`: qual equipamento e quantas unidades. */
export interface ItemReserva {
  id: string;
  quantidade: number;
}

@Injectable()
export class EquipamentosService {
  /**
   * Fila das operações de estoque. Cada operação lê, confere e grava; como há `await`
   * no meio, duas chamadas ao mesmo tempo poderiam ler o mesmo saldo e reservar a mesma
   * unidade duas vezes. Rodando uma de cada vez isso não acontece.
   */
  private fila: Promise<unknown> = Promise.resolve();

  constructor(
    @Inject(EquipamentosRepository)
    private readonly equipamentosRepository: EquipamentosRepository,
  ) {}

  /**
   * Lista com filtros e paginação, em ordem alfabética.
   * Quem não é admin não vê itens inativos nem descartados.
   */
  async listar(
    filtro: FiltroEquipamentoDto,
    perfil: Perfil = Perfil.Usuario,
  ): Promise<RespostaPaginada<Equipamento>> {
    const busca = filtro.busca?.trim().toLowerCase();
    const todos = await this.equipamentosRepository.listar();

    const filtrados = todos
      .filter(
        (e) =>
          perfil === Perfil.Admin ||
          !STATUS_OCULTOS_DO_CATALOGO.includes(e.status),
      )
      .filter((e) => !filtro.categoria || e.categoria === filtro.categoria)
      .filter((e) => !filtro.status || e.status === filtro.status)
      .filter(
        (e) =>
          !filtro.apenasDisponiveis ||
          (e.status === StatusEquipamento.Disponivel &&
            e.quantidadeDisponivel > 0),
      )
      .filter(
        (e) =>
          !busca ||
          e.nome.toLowerCase().includes(busca) ||
          e.codigoPatrimonio.toLowerCase().includes(busca),
      )
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    return montarPagina(filtrados, filtro);
  }

  /** Busca interna (outros módulos): devolve `null` quando não existe. */
  buscarPorId(id: string): Promise<Equipamento | null> {
    return this.equipamentosRepository.buscarPorId(id);
  }

  /** Para as rotas: 404 quando não existe (ou quando o professor pede um item oculto). */
  async obterPorId(
    id: string,
    perfil: Perfil = Perfil.Usuario,
  ): Promise<Equipamento> {
    const equipamento = await this.equipamentosRepository.buscarPorId(id);
    const oculto =
      equipamento &&
      perfil !== Perfil.Admin &&
      STATUS_OCULTOS_DO_CATALOGO.includes(equipamento.status);
    if (!equipamento || oculto) {
      throw new NotFoundException('Equipamento não encontrado.');
    }
    return equipamento;
  }

  // ---------------------------------------------------------------------------------
  // Estoque (usado por Empréstimos e Manutenções)
  // ---------------------------------------------------------------------------------

  /**
   * Baixa `quantidade` do saldo disponível. Exige status `disponivel` e saldo suficiente.
   * Se o saldo chegar a zero, o equipamento passa a `emprestado`.
   * Erros: 404 (não existe), 409 (indisponível ou estoque insuficiente).
   */
  async reservar(id: string, quantidade: number): Promise<Equipamento> {
    validarQuantidade(quantidade);
    return this.serializar(async () => {
      const equipamento = await this.obterOuFalhar(id);
      conferirReserva(equipamento, quantidade);
      return this.gravarReserva(equipamento, quantidade);
    });
  }

  /**
   * Devolve `quantidade` ao saldo, sem passar de `quantidadeTotal`.
   * Se estava `emprestado`, volta a `disponivel`. Em `em_manutencao`, `inativo` e
   * `descartado` o status não muda.
   * Erro: 404 (não existe).
   */
  async liberar(id: string, quantidade: number): Promise<Equipamento> {
    validarQuantidade(quantidade);
    return this.serializar(async () => {
      const equipamento = await this.obterOuFalhar(id);
      const saldo = Math.min(
        equipamento.quantidadeDisponivel + quantidade,
        equipamento.quantidadeTotal,
      );
      const status =
        equipamento.status === StatusEquipamento.Emprestado && saldo > 0
          ? StatusEquipamento.Disponivel
          : equipamento.status;
      return this.gravarEstoque(equipamento.id, saldo, status);
    });
  }

  /**
   * Reserva vários equipamentos de uma vez: confere TODOS antes de baixar qualquer um.
   * Se um falhar, nenhum é reservado. Se o mesmo id aparecer mais de uma vez, as
   * quantidades são somadas antes da conferência.
   * Devolve os equipamentos atualizados, na ordem em que os ids apareceram.
   */
  async reservarVarios(itens: ItemReserva[]): Promise<Equipamento[]> {
    if (!Array.isArray(itens) || itens.length === 0) {
      throw new BadRequestException('Informe ao menos um item para reservar.');
    }
    const somados = new Map<string, number>();
    for (const item of itens) {
      validarQuantidade(item.quantidade);
      somados.set(item.id, (somados.get(item.id) ?? 0) + item.quantidade);
    }

    return this.serializar(async () => {
      // 1) Conferir tudo, sem gravar nada.
      const conferidos: Array<{ equipamento: Equipamento; quantidade: number }> =
        [];
      for (const [id, quantidade] of somados) {
        const equipamento = await this.obterOuFalhar(id);
        conferirReserva(equipamento, quantidade);
        conferidos.push({ equipamento, quantidade });
      }
      // 2) Só agora baixar.
      const atualizados: Equipamento[] = [];
      for (const { equipamento, quantidade } of conferidos) {
        atualizados.push(await this.gravarReserva(equipamento, quantidade));
      }
      return atualizados;
    });
  }

  private async obterOuFalhar(id: string): Promise<Equipamento> {
    const equipamento = await this.equipamentosRepository.buscarPorId(id);
    if (!equipamento) {
      throw new NotFoundException('Equipamento não encontrado.');
    }
    return equipamento;
  }

  private gravarReserva(
    equipamento: Equipamento,
    quantidade: number,
  ): Promise<Equipamento> {
    const saldo = equipamento.quantidadeDisponivel - quantidade;
    return this.gravarEstoque(
      equipamento.id,
      saldo,
      saldo === 0 ? StatusEquipamento.Emprestado : equipamento.status,
    );
  }

  private async gravarEstoque(
    id: string,
    quantidadeDisponivel: number,
    status: StatusEquipamento,
  ): Promise<Equipamento> {
    const atualizado = await this.equipamentosRepository.atualizar(id, {
      quantidadeDisponivel,
      status,
      atualizadoEm: new Date().toISOString(),
    });
    if (!atualizado) {
      throw new NotFoundException('Equipamento não encontrado.');
    }
    return atualizado;
  }

  /** Roda as operações de estoque uma de cada vez, na ordem em que chegaram. */
  private serializar<T>(operacao: () => Promise<T>): Promise<T> {
    const execucao = this.fila.then(operacao);
    this.fila = execucao.catch(() => undefined);
    return execucao;
  }
}

/** A quantidade de uma reserva ou liberação é sempre um inteiro maior que zero. */
function validarQuantidade(quantidade: number): void {
  if (!Number.isInteger(quantidade) || quantidade < 1) {
    throw new BadRequestException(
      'A quantidade deve ser um número inteiro maior que zero.',
    );
  }
}

/** Lança 409 se o equipamento não puder ceder `quantidade` unidades. Não grava nada. */
function conferirReserva(equipamento: Equipamento, quantidade: number): void {
  if (equipamento.status !== StatusEquipamento.Disponivel) {
    throw new ConflictException(
      `${equipamento.nome} não está disponível (situação: ${equipamento.status}).`,
    );
  }
  if (equipamento.quantidadeDisponivel < quantidade) {
    throw new ConflictException(
      `Estoque insuficiente de ${equipamento.nome}: há ${equipamento.quantidadeDisponivel} disponível(is).`,
    );
  }
}