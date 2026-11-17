import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { montarPagina, type RespostaPaginada } from '../common/dto/index.js';
import { Perfil, StatusEquipamento } from '../common/enums/index.js';
import type { AtualizarEquipamentoDto } from './dto/atualizar-equipamento.dto.js';
import type { CriarEquipamentoDto } from './dto/criar-equipamento.dto.js';
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
   * Fila das operações que leem, conferem e gravam (estoque e cadastro). Como há `await`
   * no meio, duas chamadas ao mesmo tempo poderiam ler o mesmo saldo e reservar a mesma
   * unidade duas vezes, ou cadastrar o mesmo patrimônio duas vezes. Rodando uma de cada
   * vez isso não acontece.
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
  // Cadastro (só admin)
  // ---------------------------------------------------------------------------------

  /**
   * Cadastra um equipamento. O patrimônio é único sem diferenciar maiúsculas nem espaços
   * (409). Nasce `disponivel` e com `quantidadeDisponivel = quantidadeTotal`.
   */
  async criar(dados: CriarEquipamentoDto): Promise<Equipamento> {
    return this.serializar(async () => {
      const codigoPatrimonio = dados.codigoPatrimonio.trim();
      const alvo = normalizarPatrimonio(codigoPatrimonio);
      const existentes = await this.equipamentosRepository.listar();
      if (existentes.some((e) => normalizarPatrimonio(e.codigoPatrimonio) === alvo)) {
        throw new ConflictException(
          `Já existe um equipamento com o patrimônio ${codigoPatrimonio}.`,
        );
      }
      return this.equipamentosRepository.criar({
        nome: dados.nome,
        descricao: dados.descricao,
        codigoPatrimonio,
        categoria: dados.categoria,
        status: StatusEquipamento.Disponivel,
        localizacao: dados.localizacao,
        fotoUrl: dados.fotoUrl,
        requerTreinamento: dados.requerTreinamento,
        prazoMaximoDias: dados.prazoMaximoDias,
        quantidadeTotal: dados.quantidadeTotal,
        quantidadeDisponivel: dados.quantidadeTotal,
        criadoEm: new Date().toISOString(),
      });
    });
  }

  /**
   * Atualiza os campos informados. O `codigoPatrimonio` e o `status` nunca mudam por aqui.
   * Ao mudar `quantidadeTotal`, o disponível acompanha a diferença; se ficaria negativo
   * (há mais unidades fora do que o novo total), 409.
   */
  async atualizar(
    id: string,
    dados: AtualizarEquipamentoDto,
  ): Promise<Equipamento> {
    return this.serializar(async () => {
      const atual = await this.obterOuFalhar(id);
      const alteracoes: Partial<Omit<Equipamento, 'id'>> = {
        nome: dados.nome,
        descricao: dados.descricao,
        categoria: dados.categoria,
        localizacao: dados.localizacao,
        fotoUrl: dados.fotoUrl,
        requerTreinamento: dados.requerTreinamento,
        prazoMaximoDias: dados.prazoMaximoDias,
      };

      if (dados.quantidadeTotal !== undefined) {
        const diferenca = dados.quantidadeTotal - atual.quantidadeTotal;
        const disponivel = atual.quantidadeDisponivel + diferenca;
        if (disponivel < 0) {
          const fora = atual.quantidadeTotal - atual.quantidadeDisponivel;
          throw new ConflictException(
            `Não é possível reduzir a quantidade total de ${atual.nome} para ${dados.quantidadeTotal}: há ${fora} unidade(s) fora do estoque.`,
          );
        }
        alteracoes.quantidadeTotal = dados.quantidadeTotal;
        alteracoes.quantidadeDisponivel = disponivel;
        alteracoes.status = statusPeloSaldo(
          atual.status,
          disponivel,
          dados.quantidadeTotal,
        );
      }

      return this.salvar(id, alteracoes);
    });
  }

  /**
   * `ativo = false` inativa o equipamento, e só com todas as unidades no estoque (409 se
   * houver alguma emprestada). `ativo = true` volta a `disponivel`. Pedir o que já está
   * valendo não muda nada. Descartado não é inativado nem reativado (409).
   */
  async definirAtivo(id: string, ativo: boolean): Promise<Equipamento> {
    return this.serializar(async () => {
      const equipamento = await this.obterOuFalhar(id);

      if (equipamento.status === StatusEquipamento.Descartado) {
        throw new ConflictException(
          `${equipamento.nome} foi descartado e não pode ser ${ativo ? 'reativado' : 'inativado'}.`,
        );
      }

      if (ativo) {
        if (equipamento.status !== StatusEquipamento.Inativo) {
          return equipamento;
        }
        return this.salvar(id, { status: StatusEquipamento.Disponivel });
      }

      if (equipamento.status === StatusEquipamento.Inativo) {
        return equipamento;
      }
      if (equipamento.quantidadeDisponivel !== equipamento.quantidadeTotal) {
        const fora =
          equipamento.quantidadeTotal - equipamento.quantidadeDisponivel;
        throw new ConflictException(
          `Não é possível inativar ${equipamento.nome}: há ${fora} unidade(s) fora do estoque.`,
        );
      }
      return this.salvar(id, { status: StatusEquipamento.Inativo });
    });
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

  private gravarEstoque(
    id: string,
    quantidadeDisponivel: number,
    status: StatusEquipamento,
  ): Promise<Equipamento> {
    return this.salvar(id, { quantidadeDisponivel, status });
  }

  /** Grava as alterações (campos `undefined` são ignorados) e carimba `atualizadoEm`. */
  private async salvar(
    id: string,
    alteracoes: Partial<Omit<Equipamento, 'id'>>,
  ): Promise<Equipamento> {
    const atualizado = await this.equipamentosRepository.atualizar(id, {
      ...alteracoes,
      atualizadoEm: new Date().toISOString(),
    });
    if (!atualizado) {
      throw new NotFoundException('Equipamento não encontrado.');
    }
    return atualizado;
  }

  /** Roda as operações uma de cada vez, na ordem em que chegaram. */
  private serializar<T>(operacao: () => Promise<T>): Promise<T> {
    const execucao = this.fila.then(operacao);
    this.fila = execucao.catch(() => undefined);
    return execucao;
  }
}

/** Patrimônio sem diferenciar maiúsculas nem espaços: "PAT 001" e " pat001 " são o mesmo. */
function normalizarPatrimonio(codigo: string): string {
  return codigo.replace(/\s+/g, '').toLowerCase();
}

/**
 * Mantém o status coerente com o saldo depois de mudar o total: saldo zero em item
 * `disponivel` vira `emprestado`, e `emprestado` com saldo volta a `disponivel`.
 * Os outros status não mudam.
 */
function statusPeloSaldo(
  status: StatusEquipamento,
  disponivel: number,
  total: number,
): StatusEquipamento {
  if (
    status === StatusEquipamento.Disponivel &&
    disponivel === 0 &&
    total > 0
  ) {
    return StatusEquipamento.Emprestado;
  }
  if (status === StatusEquipamento.Emprestado && disponivel > 0) {
    return StatusEquipamento.Disponivel;
  }
  return status;
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