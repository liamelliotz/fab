import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { montarPagina, type RespostaPaginada } from '../common/dto/index.js';
import { MotivoMovimentacao, TipoMovimentacao } from '../common/enums/index.js';
import { ehDataIso } from '../common/utils/data.util.js';
import type { AtualizarInsumoDto } from './dto/atualizar-insumo.dto.js';
import type { CriarInsumoDto } from './dto/criar-insumo.dto.js';
import type { FiltroInsumoDto } from './dto/filtro-insumo.dto.js';
import type { Insumo } from './entities/insumo.entity.js';
import {
  estaComEstoqueBaixo,
  paraResposta,
  type InsumoResposta,
} from './insumo.resposta.js';
import { InsumosRepository } from './insumos.repository.js';
import { MovimentacoesRepository } from './movimentacoes.repository.js';

const MENSAGEM_NOME_REPETIDO = 'Já existe um insumo com este nome.';

/** Arredonda em 3 casas, como o banco (NUMERIC(12, 3)), para o saldo decimal não acumular erro. */
export function arredondarQuantidade(valor: number): number {
  return Math.round(valor * 1000) / 1000;
}

/**
 * Regras de insumos. D1 (este arquivo): cadastro, consulta, edição e ativação.
 * Movimentação, "a repor", histórico e relatório de consumo entram nos cards D2 a D5.
 *
 * Regra de ouro: o saldo (`quantidadeAtual`) só muda por MOVIMENTAÇÃO. Nenhum método daqui
 * grava saldo direto, nem na criação.
 */
@Injectable()
export class InsumosService {
  /**
   * Fila das operações que conferem o nome antes de gravar. Como há `await` entre conferir e
   * gravar, dois cadastros ao mesmo tempo com o mesmo nome passariam juntos. Rodando um de
   * cada vez isso não acontece (no banco, o índice único `insumos_nome_unico` é a segunda trava).
   */
  private fila: Promise<unknown> = Promise.resolve();

  constructor(
    @Inject(InsumosRepository)
    private readonly insumosRepository: InsumosRepository,
    @Inject(MovimentacoesRepository)
    private readonly movimentacoesRepository: MovimentacoesRepository,
  ) {}

  /**
   * Lista com filtros e paginação, em ordem alfabética.
   * Por padrão os desativados ficam de fora (`incluirInativos=true` traz de volta).
   * Cada item sai com `estoqueBaixo` calculado.
   */
  async listar(
    filtro: FiltroInsumoDto,
  ): Promise<RespostaPaginada<InsumoResposta>> {
    const busca = filtro.busca?.trim().toLowerCase();
    const todos = await this.insumosRepository.listar();

    const filtrados = todos
      .filter((i) => filtro.incluirInativos || i.ativo)
      .filter((i) => !filtro.categoria || i.categoria === filtro.categoria)
      .filter((i) => !filtro.apenasARepor || estaComEstoqueBaixo(i))
      .filter(
        (i) =>
          !busca ||
          i.nome.toLowerCase().includes(busca) ||
          i.fornecedor?.toLowerCase().includes(busca),
      )
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map(paraResposta);

    return montarPagina(filtrados, filtro);
  }

  /** Para as rotas: 404 quando não existe. Insumo desativado continua consultável (é admin). */
  async obterPorId(id: string): Promise<InsumoResposta> {
    return paraResposta(await this.obterOuFalhar(id));
  }

  /**
   * Cadastra um insumo. O saldo começa em zero; se `quantidadeInicial` for maior que zero,
   * registra uma entrada `ajuste_positivo` e é ela que leva o saldo até esse valor.
   * Erros: 400 (data inválida), 409 (nome repetido).
   *
   * @param responsavelId admin logado (vem do token, nunca do corpo).
   */
  async criar(
    dto: CriarInsumoDto,
    responsavelId: string,
  ): Promise<InsumoResposta> {
    const nome = dto.nome.trim();
    conferirValidade(dto.validade);
    const quantidadeInicial = arredondarQuantidade(dto.quantidadeInicial ?? 0);

    return this.serializar(async () => {
      await this.conferirNomeLivre(nome);

      const agora = new Date().toISOString();
      const criado = await this.insumosRepository.criar({
        nome,
        ...(dto.descricao ? { descricao: dto.descricao } : {}),
        categoria: dto.categoria,
        unidadeMedida: dto.unidadeMedida,
        quantidadeAtual: 0,
        estoqueMinimo: arredondarQuantidade(dto.estoqueMinimo),
        ...(dto.fornecedor ? { fornecedor: dto.fornecedor } : {}),
        ...(dto.validade ? { validade: dto.validade } : {}),
        ...(dto.localizacao ? { localizacao: dto.localizacao } : {}),
        ativo: true,
        criadoEm: agora,
      });

      if (quantidadeInicial <= 0) {
        return paraResposta(criado);
      }

      try {
        await this.movimentacoesRepository.criar({
          insumoId: criado.id,
          tipo: TipoMovimentacao.Entrada,
          quantidade: quantidadeInicial,
          saldoApos: quantidadeInicial,
          motivo: MotivoMovimentacao.AjustePositivo,
          observacao: 'Saldo inicial no cadastro do insumo.',
          responsavelId,
          ...(dto.validade ? { validadeLote: dto.validade } : {}),
          ocorridaEm: agora,
          criadoEm: agora,
        });
        const comSaldo = await this.insumosRepository.atualizar(criado.id, {
          quantidadeAtual: quantidadeInicial,
        });
        return paraResposta(comSaldo ?? criado);
      } catch (erro) {
        // Não deixa um insumo "sem a entrada que explica o saldo" para trás.
        await this.insumosRepository.remover(criado.id);
        throw erro;
      }
    });
  }

  /**
   * Edita os dados cadastrais. Só os campos do DTO são lidos: quantidade e `ativo` nunca
   * passam por aqui, mesmo que alguém chame este método com campos a mais.
   * Erros: 404, 409 (nome de outro insumo).
   */
  async atualizar(
    id: string,
    dto: AtualizarInsumoDto,
  ): Promise<InsumoResposta> {
    const alteracoes: Partial<
      Pick<
        Insumo,
        | 'nome'
        | 'descricao'
        | 'categoria'
        | 'unidadeMedida'
        | 'estoqueMinimo'
        | 'fornecedor'
        | 'localizacao'
      >
    > = {
      nome: dto.nome?.trim(),
      descricao: dto.descricao,
      categoria: dto.categoria,
      unidadeMedida: dto.unidadeMedida,
      estoqueMinimo:
        dto.estoqueMinimo === undefined
          ? undefined
          : arredondarQuantidade(dto.estoqueMinimo),
      fornecedor: dto.fornecedor,
      localizacao: dto.localizacao,
    };
    const nada = Object.values(alteracoes).every(
      (valor) => valor === undefined,
    );

    return this.serializar(async () => {
      const atual = await this.obterOuFalhar(id);
      if (nada) {
        return paraResposta(atual);
      }
      if (alteracoes.nome !== undefined) {
        await this.conferirNomeLivre(alteracoes.nome, id);
      }
      const atualizado = await this.insumosRepository.atualizar(id, {
        ...alteracoes,
        atualizadoEm: new Date().toISOString(),
      });
      if (!atualizado) {
        throw new NotFoundException('Insumo não encontrado.');
      }
      return paraResposta(atualizado);
    });
  }

  /**
   * Ativa ou desativa. Desativado some das listas comuns e não aceita movimentação (D2).
   * Pedir o mesmo estado que o insumo já tem não é erro.
   * Erro: 404.
   */
  async alterarAtivo(id: string, ativo: boolean): Promise<InsumoResposta> {
    return this.serializar(async () => {
      const atual = await this.obterOuFalhar(id);
      if (atual.ativo === ativo) {
        return paraResposta(atual);
      }
      const atualizado = await this.insumosRepository.atualizar(id, {
        ativo,
        atualizadoEm: new Date().toISOString(),
      });
      if (!atualizado) {
        throw new NotFoundException('Insumo não encontrado.');
      }
      return paraResposta(atualizado);
    });
  }

  private async obterOuFalhar(id: string): Promise<Insumo> {
    const insumo = await this.insumosRepository.buscarPorId(id);
    if (!insumo) {
      throw new NotFoundException('Insumo não encontrado.');
    }
    return insumo;
  }

  /** 409 se outro insumo (que não seja `ignorarId`) já usa o nome. */
  private async conferirNomeLivre(
    nome: string,
    ignorarId?: string,
  ): Promise<void> {
    const repetido = await this.insumosRepository.buscarPorNome(
      nome,
      ignorarId,
    );
    if (repetido) {
      throw new ConflictException(MENSAGEM_NOME_REPETIDO);
    }
  }

  /** Roda as operações uma de cada vez, na ordem em que chegaram. */
  private serializar<T>(operacao: () => Promise<T>): Promise<T> {
    const execucao = this.fila.then(operacao);
    this.fila = execucao.catch(() => undefined);
    return execucao;
  }
}

/** Confere se a validade é uma data de calendário que existe (30/02 não passa). */
function conferirValidade(validade: string | undefined): void {
  if (validade !== undefined && !ehDataIso(validade)) {
    throw new BadRequestException(
      'validade deve ser uma data válida no formato AAAA-MM-DD.',
    );
  }
}
