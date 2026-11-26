import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CategoriaInsumo,
  MotivoMovimentacao,
  TipoMovimentacao,
  UnidadeMedida,
} from '../common/enums/index.js';
import { INSUMO_IDS, USUARIO_IDS } from '../common/seed/ids.js';
import type { AtualizarInsumoDto } from './dto/atualizar-insumo.dto.js';
import type { CriarInsumoDto } from './dto/criar-insumo.dto.js';
import { FiltroInsumoDto } from './dto/filtro-insumo.dto.js';
import { InsumosRepository } from './insumos.repository.js';
import { InsumosService } from './insumos.service.js';
import { MovimentacoesRepository } from './movimentacoes.repository.js';

const ADMIN = USUARIO_IDS.admin;

/** Um corpo de POST válido; cada teste sobrescreve só o que importa. */
function novo(parcial: Partial<CriarInsumoDto> = {}): CriarInsumoDto {
  return {
    nome: 'Cola quente (bastão)',
    categoria: CategoriaInsumo.Ferragens,
    unidadeMedida: UnidadeMedida.Unidade,
    estoqueMinimo: 2,
    ...parcial,
  };
}

/** Um filtro com os padrões de paginação (o ValidationPipe faz isso na API de verdade). */
function filtro(parcial: Partial<FiltroInsumoDto> = {}): FiltroInsumoDto {
  return Object.assign(new FiltroInsumoDto(), parcial);
}

describe('InsumosService (cadastro, D1)', () => {
  let insumos: InsumosRepository;
  let movimentacoes: MovimentacoesRepository;
  let service: InsumosService;

  beforeEach(async () => {
    insumos = new InsumosRepository();
    movimentacoes = new MovimentacoesRepository();
    await insumos.onModuleInit();
    await movimentacoes.onModuleInit();
    service = new InsumosService(insumos, movimentacoes);
  });

  describe('listar', () => {
    it('devolve só os ativos, em ordem alfabética, com estoqueBaixo calculado', async () => {
      const pagina = await service.listar(filtro());
      expect(pagina.totalItens).toBe(6);
      const nomes = pagina.itens.map((i) => i.nome);
      expect(nomes).toEqual(
        [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      );
      const baixo = (id: string) =>
        pagina.itens.find((i) => i.id === id)?.estoqueBaixo;
      expect(baixo(INSUMO_IDS.filamentoPla)).toBe(true); // 2 <= 3
      expect(baixo(INSUMO_IDS.pincelQuadro)).toBe(true); // 0 <= 10
      expect(baixo(INSUMO_IDS.estanho)).toBe(false); // 1,25 > 0,5
    });

    it('estoque exatamente no mínimo conta como baixo', async () => {
      const criado = await service.criar(
        novo({ estoqueMinimo: 5, quantidadeInicial: 5 }),
        ADMIN,
      );
      expect(criado.estoqueBaixo).toBe(true);
    });

    it('apenasARepor traz só os itens que atingiram o mínimo', async () => {
      const pagina = await service.listar(filtro({ apenasARepor: true }));
      expect(pagina.itens.map((i) => i.id).sort()).toEqual([
        INSUMO_IDS.filamentoPla,
        INSUMO_IDS.pincelQuadro,
      ]);
    });

    it('filtra por categoria e busca no nome e no fornecedor, sem diferenciar maiúsculas', async () => {
      const eletronica = await service.listar(
        filtro({ categoria: CategoriaInsumo.Eletronica }),
      );
      expect(eletronica.itens.map((i) => i.id).sort()).toEqual([
        INSUMO_IDS.estanho,
        INSUMO_IDS.resistores,
      ]);

      // "resma" só aparece no nome do papel (já "papel" também está no fornecedor do pincel).
      const porNome = await service.listar(filtro({ busca: 'RESMA' }));
      expect(porNome.itens.map((i) => i.id)).toEqual([INSUMO_IDS.papelA4]);

      const porFornecedor = await service.listar(filtro({ busca: 'química' }));
      expect(porFornecedor.itens.map((i) => i.id)).toEqual([
        INSUMO_IDS.alcoolIsopropilico,
      ]);
    });

    it('desativado some da lista, volta com incluirInativos e nunca é "a repor"', async () => {
      await service.alterarAtivo(INSUMO_IDS.filamentoPla, false);

      const padrao = await service.listar(filtro());
      expect(padrao.itens.map((i) => i.id)).not.toContain(
        INSUMO_IDS.filamentoPla,
      );

      const todos = await service.listar(filtro({ incluirInativos: true }));
      expect(todos.totalItens).toBe(6);
      expect(
        todos.itens.find((i) => i.id === INSUMO_IDS.filamentoPla)?.estoqueBaixo,
      ).toBe(false);

      const aRepor = await service.listar(
        filtro({ apenasARepor: true, incluirInativos: true }),
      );
      expect(aRepor.itens.map((i) => i.id)).toEqual([INSUMO_IDS.pincelQuadro]);
    });

    it('pagina o resultado', async () => {
      const segunda = await service.listar(
        filtro({ pagina: 2, itensPorPagina: 4 }),
      );
      expect(segunda.itens).toHaveLength(2);
      expect(segunda).toMatchObject({
        totalItens: 6,
        totalPaginas: 2,
        temAnterior: true,
        temProxima: false,
      });
    });
  });

  describe('obterPorId', () => {
    it('devolve o insumo com estoqueBaixo', async () => {
      const insumo = await service.obterPorId(INSUMO_IDS.alcoolIsopropilico);
      expect(insumo.nome).toBe('Álcool isopropílico 1 L');
      expect(insumo.estoqueBaixo).toBe(false);
    });

    it('404 quando não existe', async () => {
      await expect(service.obterPorId('nao-existe')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('criar', () => {
    it('sem quantidadeInicial: saldo zero e nenhuma movimentação', async () => {
      const criado = await service.criar(novo(), ADMIN);
      expect(criado).toMatchObject({
        nome: 'Cola quente (bastão)',
        quantidadeAtual: 0,
        ativo: true,
        estoqueBaixo: true,
      });
      expect(await movimentacoes.listarDoInsumo(criado.id)).toHaveLength(0);
    });

    it('quantidadeInicial 0 também não gera movimentação', async () => {
      const criado = await service.criar(novo({ quantidadeInicial: 0 }), ADMIN);
      expect(criado.quantidadeAtual).toBe(0);
      expect(await movimentacoes.listarDoInsumo(criado.id)).toHaveLength(0);
    });

    it('quantidadeInicial 5 vira uma entrada ajuste_positivo de 5, e o saldo vem dela', async () => {
      const criado = await service.criar(novo({ quantidadeInicial: 5 }), ADMIN);
      expect(criado.quantidadeAtual).toBe(5);

      const doInsumo = await movimentacoes.listarDoInsumo(criado.id);
      expect(doInsumo).toHaveLength(1);
      expect(doInsumo[0]).toMatchObject({
        insumoId: criado.id,
        tipo: TipoMovimentacao.Entrada,
        motivo: MotivoMovimentacao.AjustePositivo,
        quantidade: 5,
        saldoApos: 5,
        responsavelId: ADMIN,
      });
    });

    it('aceita saldo decimal (até 3 casas)', async () => {
      const criado = await service.criar(
        novo({
          unidadeMedida: UnidadeMedida.Quilo,
          quantidadeInicial: 0.25,
          estoqueMinimo: 0.1,
        }),
        ADMIN,
      );
      expect(criado.quantidadeAtual).toBe(0.25);
      expect(criado.estoqueBaixo).toBe(false);
    });

    it('a validade informada vai também para o lote da entrada inicial', async () => {
      const criado = await service.criar(
        novo({ quantidadeInicial: 3, validade: '2027-03-31' }),
        ADMIN,
      );
      expect(criado.validade).toBe('2027-03-31');
      const [entrada] = await movimentacoes.listarDoInsumo(criado.id);
      expect(entrada.validadeLote).toBe('2027-03-31');
    });

    it('tira os espaços das pontas do nome', async () => {
      const criado = await service.criar(
        novo({ nome: '  Cola quente (bastão)  ' }),
        ADMIN,
      );
      expect(criado.nome).toBe('Cola quente (bastão)');
    });

    it('409 com nome repetido, mesmo com outra caixa e espaços nas pontas', async () => {
      await expect(
        service.criar(novo({ nome: '  ESTANHO PARA SOLDA 60/40 ' }), ADMIN),
      ).rejects.toThrow(
        new ConflictException('Já existe um insumo com este nome.'),
      );
      expect(await insumos.contar()).toBe(6);
    });

    it('400 com validade que não existe no calendário, sem gravar nada', async () => {
      await expect(
        service.criar(novo({ validade: '2027-02-30' }), ADMIN),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(await insumos.contar()).toBe(6);
    });

    it('dois cadastros do mesmo nome ao mesmo tempo: só um passa', async () => {
      const resultados = await Promise.allSettled([
        service.criar(novo({ nome: 'Fita isolante' }), ADMIN),
        service.criar(novo({ nome: 'FITA ISOLANTE ' }), ADMIN),
      ]);
      expect(resultados.map((r) => r.status).sort()).toEqual([
        'fulfilled',
        'rejected',
      ]);
      const rejeitado = resultados.find((r) => r.status === 'rejected');
      expect(rejeitado?.reason).toBeInstanceOf(ConflictException);
      expect(await insumos.contar()).toBe(7);
    });
  });

  describe('atualizar', () => {
    it('muda só os campos informados', async () => {
      const atualizado = await service.atualizar(INSUMO_IDS.filamentoPla, {
        fornecedor: 'Nova Fila 3D',
        estoqueMinimo: 1,
      });
      expect(atualizado).toMatchObject({
        nome: 'Filamento PLA 1 kg (branco)',
        fornecedor: 'Nova Fila 3D',
        estoqueMinimo: 1,
        quantidadeAtual: 2,
        estoqueBaixo: false, // 2 > 1: o alerta acompanha o novo mínimo
      });
      expect(atualizado.atualizadoEm).toBeDefined();
    });

    it('não aceita quantidade: enviar quantidadeAtual não muda o saldo', async () => {
      // O ValidationPipe já descarta o campo; aqui conferimos que o service também o ignora.
      const corpo = {
        nome: 'Filamento PLA 1 kg (branco)',
        quantidadeAtual: 999,
        quantidadeInicial: 999,
      } as unknown as AtualizarInsumoDto;
      const atualizado = await service.atualizar(
        INSUMO_IDS.filamentoPla,
        corpo,
      );
      expect(atualizado.quantidadeAtual).toBe(2);
      expect(
        (await insumos.buscarPorId(INSUMO_IDS.filamentoPla))?.quantidadeAtual,
      ).toBe(2);
    });

    it('nenhuma movimentação nova é criada', async () => {
      const antes = await movimentacoes.contar();
      await service.atualizar(INSUMO_IDS.estanho, { localizacao: 'Gaveta 9' });
      expect(await movimentacoes.contar()).toBe(antes);
    });

    it('corpo sem nenhum campo devolve o insumo como está', async () => {
      const antes = await service.obterPorId(INSUMO_IDS.estanho);
      const depois = await service.atualizar(INSUMO_IDS.estanho, {});
      expect(depois).toEqual(antes);
    });

    it('pode trocar só a caixa do próprio nome', async () => {
      const atualizado = await service.atualizar(INSUMO_IDS.estanho, {
        nome: 'ESTANHO PARA SOLDA 60/40',
      });
      expect(atualizado.nome).toBe('ESTANHO PARA SOLDA 60/40');
    });

    it('409 com o nome de outro insumo, mesmo com outra caixa', async () => {
      await expect(
        service.atualizar(INSUMO_IDS.pincelQuadro, {
          nome: ' estanho para solda 60/40',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect((await insumos.buscarPorId(INSUMO_IDS.pincelQuadro))?.nome).toBe(
        'Pincel para quadro branco (azul)',
      );
    });

    it('404 quando não existe', async () => {
      await expect(
        service.atualizar('nao-existe', { nome: 'Qualquer' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('alterarAtivo', () => {
    it('desativa e reativa', async () => {
      const desativado = await service.alterarAtivo(INSUMO_IDS.estanho, false);
      expect(desativado.ativo).toBe(false);
      const reativado = await service.alterarAtivo(INSUMO_IDS.estanho, true);
      expect(reativado.ativo).toBe(true);
    });

    it('pedir o estado que já vale não é erro', async () => {
      const igual = await service.alterarAtivo(INSUMO_IDS.estanho, true);
      expect(igual.ativo).toBe(true);
    });

    it('404 quando não existe', async () => {
      await expect(
        service.alterarAtivo('nao-existe', false),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
