import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CategoriaEquipamento,
  StatusEquipamento,
} from '../common/enums/index.js';
import type { CriarEquipamentoDto } from './dto/criar-equipamento.dto.js';
import type { Equipamento } from './entities/equipamento.entity.js';
import { EquipamentosRepository } from './equipamentos.repository.js';
import { EquipamentosService } from './equipamentos.service.js';

function novo(dados: Partial<Equipamento> & { id: string }): Equipamento {
  return {
    nome: `Equipamento ${dados.id}`,
    descricao: 'Item de teste',
    codigoPatrimonio: `PAT-${dados.id}`,
    categoria: CategoriaEquipamento.Eletronico,
    status: StatusEquipamento.Disponivel,
    localizacao: 'Bancada 01',
    requerTreinamento: false,
    prazoMaximoDias: 7,
    quantidadeTotal: 5,
    quantidadeDisponivel: 5,
    criadoEm: new Date().toISOString(),
    ...dados,
  };
}

describe('EquipamentosService (estoque)', () => {
  let repositorio: EquipamentosRepository;
  let service: EquipamentosService;

  beforeEach(async () => {
    repositorio = new EquipamentosRepository();
    service = new EquipamentosService(repositorio);
    await repositorio.criar(
      novo({ id: 'a', nome: 'Multímetro', quantidadeTotal: 5, quantidadeDisponivel: 5 }),
    );
    await repositorio.criar(
      novo({ id: 'b', nome: 'Arduino', quantidadeTotal: 3, quantidadeDisponivel: 3 }),
    );
  });

  describe('reservar', () => {
    it('baixa o saldo e mantém o status enquanto sobrar unidade', async () => {
      const resultado = await service.reservar('a', 2);
      expect(resultado.quantidadeDisponivel).toBe(3);
      expect(resultado.status).toBe(StatusEquipamento.Disponivel);
      expect((await repositorio.buscarPorId('a'))?.quantidadeDisponivel).toBe(3);
    });

    it('ao zerar o saldo, o status vira emprestado', async () => {
      const resultado = await service.reservar('a', 5);
      expect(resultado.quantidadeDisponivel).toBe(0);
      expect(resultado.status).toBe(StatusEquipamento.Emprestado);
    });

    it('409 com a mensagem de estoque insuficiente', async () => {
      await expect(service.reservar('a', 6)).rejects.toThrow(
        new ConflictException('Estoque insuficiente de Multímetro: há 5 disponível(is).'),
      );
      expect((await repositorio.buscarPorId('a'))?.quantidadeDisponivel).toBe(5);
    });

    it('409 se o equipamento não está disponível', async () => {
      await repositorio.atualizar('a', { status: StatusEquipamento.EmManutencao });
      await expect(service.reservar('a', 1)).rejects.toBeInstanceOf(ConflictException);
    });

    it('404 se o equipamento não existe', async () => {
      await expect(service.reservar('x', 1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('400 para quantidade zero, negativa ou fracionada', async () => {
      for (const quantidade of [0, -1, 1.5, Number.NaN]) {
        await expect(service.reservar('a', quantidade)).rejects.toThrow();
      }
      expect((await repositorio.buscarPorId('a'))?.quantidadeDisponivel).toBe(5);
    });

    it('duas reservas simultâneas não passam do saldo', async () => {
      const resultados = await Promise.allSettled([
        service.reservar('a', 3),
        service.reservar('a', 3),
      ]);
      expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect((await repositorio.buscarPorId('a'))?.quantidadeDisponivel).toBe(2);
    });
  });

  describe('liberar', () => {
    it('soma de volta ao saldo', async () => {
      await service.reservar('a', 3);
      const resultado = await service.liberar('a', 2);
      expect(resultado.quantidadeDisponivel).toBe(4);
    });

    it('não passa do total', async () => {
      await service.reservar('a', 1);
      const resultado = await service.liberar('a', 10);
      expect(resultado.quantidadeDisponivel).toBe(5);
    });

    it('se estava emprestado, volta a disponivel', async () => {
      await service.reservar('a', 5);
      const resultado = await service.liberar('a', 1);
      expect(resultado.status).toBe(StatusEquipamento.Disponivel);
      expect(resultado.quantidadeDisponivel).toBe(1);
    });

    it.each([
      StatusEquipamento.EmManutencao,
      StatusEquipamento.Inativo,
      StatusEquipamento.Descartado,
    ])('não muda o status %s', async (status) => {
      await repositorio.atualizar('a', { status, quantidadeDisponivel: 1 });
      const resultado = await service.liberar('a', 2);
      expect(resultado.status).toBe(status);
      expect(resultado.quantidadeDisponivel).toBe(3);
    });

    it('404 se o equipamento não existe', async () => {
      await expect(service.liberar('x', 1)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('reservarVarios', () => {
    it('reserva todos quando tudo está em ordem', async () => {
      const resultado = await service.reservarVarios([
        { id: 'a', quantidade: 2 },
        { id: 'b', quantidade: 3 },
      ]);
      expect(resultado.map((e) => e.quantidadeDisponivel)).toEqual([3, 0]);
      expect((await repositorio.buscarPorId('b'))?.status).toBe(
        StatusEquipamento.Emprestado,
      );
    });

    it('se um falhar no meio, nenhum é reservado', async () => {
      await expect(
        service.reservarVarios([
          { id: 'a', quantidade: 2 },
          { id: 'b', quantidade: 4 },
        ]),
      ).rejects.toThrow(
        new ConflictException('Estoque insuficiente de Arduino: há 3 disponível(is).'),
      );
      expect((await repositorio.buscarPorId('a'))?.quantidadeDisponivel).toBe(5);
      expect((await repositorio.buscarPorId('b'))?.quantidadeDisponivel).toBe(3);
    });

    it('se um id não existe, nenhum é reservado (404)', async () => {
      await expect(
        service.reservarVarios([
          { id: 'a', quantidade: 1 },
          { id: 'x', quantidade: 1 },
        ]),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect((await repositorio.buscarPorId('a'))?.quantidadeDisponivel).toBe(5);
    });

    it('soma as quantidades quando o mesmo id se repete', async () => {
      await expect(
        service.reservarVarios([
          { id: 'b', quantidade: 2 },
          { id: 'b', quantidade: 2 },
        ]),
      ).rejects.toBeInstanceOf(ConflictException);
      expect((await repositorio.buscarPorId('b'))?.quantidadeDisponivel).toBe(3);
    });

    it('400 com lista vazia', async () => {
      await expect(service.reservarVarios([])).rejects.toThrow();
    });
  });
});

describe('EquipamentosService (cadastro)', () => {
  let repositorio: EquipamentosRepository;
  let service: EquipamentosService;

  function dadosNovos(parcial: Partial<CriarEquipamentoDto> = {}): CriarEquipamentoDto {
    return {
      nome: 'Osciloscópio',
      descricao: 'Item de teste',
      codigoPatrimonio: 'PAT-0100',
      categoria: CategoriaEquipamento.Eletronico,
      localizacao: 'Bancada 02',
      requerTreinamento: false,
      prazoMaximoDias: 7,
      quantidadeTotal: 4,
      ...parcial,
    };
  }

  beforeEach(async () => {
    repositorio = new EquipamentosRepository();
    service = new EquipamentosService(repositorio);
    await repositorio.criar(
      novo({
        id: 'a',
        nome: 'Multímetro',
        codigoPatrimonio: 'PAT-0001',
        quantidadeTotal: 5,
        quantidadeDisponivel: 5,
      }),
    );
  });

  describe('criar', () => {
    it('nasce disponivel e com quantidadeDisponivel igual ao total', async () => {
      const criado = await service.criar(dadosNovos({ quantidadeTotal: 4 }));
      expect(criado.status).toBe(StatusEquipamento.Disponivel);
      expect(criado.quantidadeTotal).toBe(4);
      expect(criado.quantidadeDisponivel).toBe(4);
      expect((await repositorio.buscarPorId(criado.id))?.nome).toBe('Osciloscópio');
    });

    it('guarda o patrimônio sem os espaços das pontas', async () => {
      const criado = await service.criar(dadosNovos({ codigoPatrimonio: '  PAT-0100  ' }));
      expect(criado.codigoPatrimonio).toBe('PAT-0100');
    });

    it('409 com patrimônio repetido, sem diferenciar maiúsculas', async () => {
      await expect(
        service.criar(dadosNovos({ codigoPatrimonio: 'pat-0001' })),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(await repositorio.contar()).toBe(1);
    });

    it('409 com patrimônio repetido, sem diferenciar espaços', async () => {
      await service.criar(dadosNovos({ codigoPatrimonio: 'PAT 0200' }));
      await expect(
        service.criar(dadosNovos({ codigoPatrimonio: ' pat0200 ' })),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(await repositorio.contar()).toBe(2);
    });

    it('dois cadastros simultâneos do mesmo patrimônio: só um passa', async () => {
      const resultados = await Promise.allSettled([
        service.criar(dadosNovos({ codigoPatrimonio: 'PAT-0300' })),
        service.criar(dadosNovos({ codigoPatrimonio: 'pat-0300' })),
      ]);
      expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await repositorio.contar()).toBe(2);
    });
  });

  describe('atualizar', () => {
    it('muda só os campos enviados e não mexe no patrimônio nem no estoque', async () => {
      const resultado = await service.atualizar('a', {
        nome: 'Multímetro Novo',
        prazoMaximoDias: 10,
      });
      expect(resultado.nome).toBe('Multímetro Novo');
      expect(resultado.prazoMaximoDias).toBe(10);
      expect(resultado.codigoPatrimonio).toBe('PAT-0001');
      expect(resultado.localizacao).toBe('Bancada 01');
      expect(resultado.quantidadeTotal).toBe(5);
      expect(resultado.quantidadeDisponivel).toBe(5);
    });

    it('aumentar o total soma a diferença ao disponível', async () => {
      await service.reservar('a', 2); // disponível 3
      const resultado = await service.atualizar('a', { quantidadeTotal: 8 });
      expect(resultado.quantidadeTotal).toBe(8);
      expect(resultado.quantidadeDisponivel).toBe(6);
    });

    it('reduzir o total tira a diferença do disponível', async () => {
      const resultado = await service.atualizar('a', { quantidadeTotal: 3 });
      expect(resultado.quantidadeTotal).toBe(3);
      expect(resultado.quantidadeDisponivel).toBe(3);
    });

    it('409 se o disponível ficaria negativo, e nada muda', async () => {
      await service.reservar('a', 3); // disponível 2, fora 3
      await expect(service.atualizar('a', { quantidadeTotal: 2 })).rejects.toBeInstanceOf(
        ConflictException,
      );
      const guardado = await repositorio.buscarPorId('a');
      expect(guardado?.quantidadeTotal).toBe(5);
      expect(guardado?.quantidadeDisponivel).toBe(2);
    });

    it('reduzir até o disponível chegar a zero vira emprestado', async () => {
      await service.reservar('a', 3); // disponível 2, fora 3
      const resultado = await service.atualizar('a', { quantidadeTotal: 3 });
      expect(resultado.quantidadeDisponivel).toBe(0);
      expect(resultado.status).toBe(StatusEquipamento.Emprestado);
    });

    it('aumentar o total de um item emprestado volta a disponivel', async () => {
      await service.reservar('a', 5);
      const resultado = await service.atualizar('a', { quantidadeTotal: 8 });
      expect(resultado.quantidadeDisponivel).toBe(3);
      expect(resultado.status).toBe(StatusEquipamento.Disponivel);
    });

    it('404 se o equipamento não existe', async () => {
      await expect(service.atualizar('x', { nome: 'Novo' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('definirAtivo', () => {
    it('false com todas as unidades em casa vira inativo', async () => {
      const resultado = await service.definirAtivo('a', false);
      expect(resultado.status).toBe(StatusEquipamento.Inativo);
    });

    it('false com unidade emprestada: 409, e o status não muda', async () => {
      await service.reservar('a', 1);
      await expect(service.definirAtivo('a', false)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect((await repositorio.buscarPorId('a'))?.status).toBe(
        StatusEquipamento.Disponivel,
      );
    });

    it('true volta a disponivel', async () => {
      await service.definirAtivo('a', false);
      const resultado = await service.definirAtivo('a', true);
      expect(resultado.status).toBe(StatusEquipamento.Disponivel);
      expect(resultado.quantidadeDisponivel).toBe(5);
    });

    it('pedir o que já vale não muda nada', async () => {
      await service.reservar('a', 5); // emprestado
      const aindaAtivo = await service.definirAtivo('a', true);
      expect(aindaAtivo.status).toBe(StatusEquipamento.Emprestado);

      await repositorio.atualizar('a', {
        status: StatusEquipamento.Inativo,
        quantidadeDisponivel: 5,
      });
      const aindaInativo = await service.definirAtivo('a', false);
      expect(aindaInativo.status).toBe(StatusEquipamento.Inativo);
    });

    it.each([true, false])('descartado não é inativado nem reativado (ativo=%s)', async (ativo) => {
      await repositorio.atualizar('a', { status: StatusEquipamento.Descartado });
      await expect(service.definirAtivo('a', ativo)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect((await repositorio.buscarPorId('a'))?.status).toBe(
        StatusEquipamento.Descartado,
      );
    });

    it('404 se o equipamento não existe', async () => {
      await expect(service.definirAtivo('x', false)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});