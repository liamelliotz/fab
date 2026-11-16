import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import {Perfil,
  CategoriaEquipamento,
  StatusEquipamento,
} from '../common/enums/index.js';
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