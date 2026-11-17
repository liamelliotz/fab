import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { aplicarPadraoDeResposta } from '../src/common/aplicar-padrao-resposta.js';
import {
  CategoriaEquipamento,
  StatusEquipamento,
} from '../src/common/enums/index.js';
import type { Equipamento } from '../src/equipamentos/entities/equipamento.entity.js';
import { EquipamentosRepository } from '../src/equipamentos/equipamentos.repository.js';
import { EquipamentosService } from '../src/equipamentos/equipamentos.service.js';

/** Envelope de toda resposta da API (common/dto/resposta-api.dto.ts). */
interface Envelope<T = unknown> {
  sucesso: boolean;
  mensagem?: string;
  dados: T | null;
  erros: string[];
}

describe('Equipamentos: rotas de escrita (e2e)', () => {
  let app: INestApplication;
  let equipamentos: EquipamentosService;
  let repositorio: EquipamentosRepository;
  let tokenAdmin: string;
  let tokenProfessor: string;
  let sequencia = 0;

  /** Corpo válido de cadastro, com patrimônio diferente a cada chamada. */
  function corpo(parcial: Record<string, unknown> = {}) {
    sequencia += 1;
    return {
      nome: `Equipamento E2E ${sequencia}`,
      descricao: 'Criado pelo teste e2e',
      codigoPatrimonio: `E2E-${sequencia}`,
      categoria: CategoriaEquipamento.Eletronico,
      localizacao: 'Bancada de testes',
      requerTreinamento: false,
      prazoMaximoDias: 7,
      quantidadeTotal: 5,
      ...parcial,
    };
  }

  async function entrar(email: string, senha: string): Promise<string> {
    const resposta = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, senha });
    const envelope = resposta.body as Envelope<{ tokenAcesso: string }>;
    return envelope.dados?.tokenAcesso ?? '';
  }

  function comoAdmin(req: request.Test): request.Test {
    return req.set('Authorization', `Bearer ${tokenAdmin}`);
  }

  function comoProfessor(req: request.Test): request.Test {
    return req.set('Authorization', `Bearer ${tokenProfessor}`);
  }

  /** Cadastra pela rota e devolve o equipamento criado. */
  async function cadastrar(parcial: Record<string, unknown> = {}): Promise<Equipamento> {
    const resposta = await comoAdmin(
      request(app.getHttpServer()).post('/api/equipamentos').send(corpo(parcial)),
    );
    expect(resposta.status).toBe(201);
    return (resposta.body as Envelope<Equipamento>).dados as Equipamento;
  }

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = modulo.createNestApplication();
    // Mesma configuração do main.ts: prefixo, validação e envelope de resposta.
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    aplicarPadraoDeResposta(app);
    await app.init();

    equipamentos = app.get(EquipamentosService);
    repositorio = app.get(EquipamentosRepository);
    tokenAdmin = await entrar('admin@fab.com', 'admin123');
    tokenProfessor = await entrar('professor@fab.com', 'prof123');
  });

  beforeEach(async () => {
    await repositorio.redefinir();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('permissões', () => {
    it('sem token: 401 nas três rotas', async () => {
      const http = request(app.getHttpServer());
      expect((await http.post('/api/equipamentos').send(corpo())).status).toBe(401);
      expect((await http.patch('/api/equipamentos/x').send({})).status).toBe(401);
      expect(
        (await http.patch('/api/equipamentos/x/ativo').send({ ativo: false })).status,
      ).toBe(401);
    });

    it('professor: 403 nas três rotas', async () => {
      const http = request(app.getHttpServer());
      expect(
        (await comoProfessor(http.post('/api/equipamentos').send(corpo()))).status,
      ).toBe(403);
      expect(
        (await comoProfessor(http.patch('/api/equipamentos/x').send({ nome: 'Novo' })))
          .status,
      ).toBe(403);
      expect(
        (
          await comoProfessor(
            http.patch('/api/equipamentos/x/ativo').send({ ativo: false }),
          )
        ).status,
      ).toBe(403);
    });
  });

  describe('POST /equipamentos', () => {
    it('admin cadastra: nasce disponivel e com disponível igual ao total', async () => {
      const resposta = await comoAdmin(
        request(app.getHttpServer())
          .post('/api/equipamentos')
          .send(corpo({ quantidadeTotal: 4 })),
      );
      const envelope = resposta.body as Envelope<Equipamento>;
      expect(resposta.status).toBe(201);
      expect(envelope.sucesso).toBe(true);
      expect(envelope.dados?.status).toBe(StatusEquipamento.Disponivel);
      expect(envelope.dados?.quantidadeTotal).toBe(4);
      expect(envelope.dados?.quantidadeDisponivel).toBe(4);

      const consulta = await comoAdmin(
        request(app.getHttpServer()).get(`/api/equipamentos/${envelope.dados?.id}`),
      );
      expect(consulta.status).toBe(200);
    });

    it('409 com patrimônio repetido, sem diferenciar maiúsculas nem espaços', async () => {
      await cadastrar({ codigoPatrimonio: 'PAT-ABC 1' });
      const resposta = await comoAdmin(
        request(app.getHttpServer())
          .post('/api/equipamentos')
          .send(corpo({ codigoPatrimonio: ' pat-abc1 ' })),
      );
      expect(resposta.status).toBe(409);
      expect((resposta.body as Envelope).sucesso).toBe(false);
    });

    it('409 com o patrimônio de um item do acervo, em minúsculas e com espaços', async () => {
      const existente = (await repositorio.listar())[0];
      const resposta = await comoAdmin(
        request(app.getHttpServer())
          .post('/api/equipamentos')
          .send(
            corpo({
              codigoPatrimonio: `  ${existente?.codigoPatrimonio.toLowerCase() ?? ''}  `,
            }),
          ),
      );
      expect(resposta.status).toBe(409);
    });

    it('400 com prazoMaximoDias fora de 1 a 365', async () => {
      for (const prazoMaximoDias of [0, 366, 1.5]) {
        const resposta = await comoAdmin(
          request(app.getHttpServer())
            .post('/api/equipamentos')
            .send(corpo({ prazoMaximoDias })),
        );
        expect(resposta.status).toBe(400);
      }
    });

    it('400 com quantidadeTotal negativa ou fracionada; 0 é aceito', async () => {
      for (const quantidadeTotal of [-1, 2.5]) {
        const resposta = await comoAdmin(
          request(app.getHttpServer())
            .post('/api/equipamentos')
            .send(corpo({ quantidadeTotal })),
        );
        expect(resposta.status).toBe(400);
      }
      const zero = await comoAdmin(
        request(app.getHttpServer())
          .post('/api/equipamentos')
          .send(corpo({ quantidadeTotal: 0 })),
      );
      expect(zero.status).toBe(201);
    });

    it('400 sem os campos obrigatórios', async () => {
      const resposta = await comoAdmin(
        request(app.getHttpServer()).post('/api/equipamentos').send({}),
      );
      expect(resposta.status).toBe(400);
    });
  });

  describe('PATCH /equipamentos/:id', () => {
    it('muda os campos enviados e mantém o patrimônio', async () => {
      const criado = await cadastrar({ codigoPatrimonio: 'E2E-FIXO' });
      const resposta = await comoAdmin(
        request(app.getHttpServer())
          .patch(`/api/equipamentos/${criado.id}`)
          .send({ nome: 'Nome novo', prazoMaximoDias: 14 }),
      );
      const envelope = resposta.body as Envelope<Equipamento>;
      expect(resposta.status).toBe(200);
      expect(envelope.dados?.nome).toBe('Nome novo');
      expect(envelope.dados?.prazoMaximoDias).toBe(14);
      expect(envelope.dados?.codigoPatrimonio).toBe('E2E-FIXO');
    });

    it('400 se vier o codigoPatrimonio', async () => {
      const criado = await cadastrar({ codigoPatrimonio: 'E2E-TRAVADO' });
      const resposta = await comoAdmin(
        request(app.getHttpServer())
          .patch(`/api/equipamentos/${criado.id}`)
          .send({ codigoPatrimonio: 'OUTRO' }),
      );
      expect(resposta.status).toBe(400);
      const guardado = await repositorio.buscarPorId(criado.id);
      expect(guardado?.codigoPatrimonio).toBe('E2E-TRAVADO');
    });

    it('400 com prazoMaximoDias ou quantidadeTotal inválidos', async () => {
      const criado = await cadastrar();
      for (const parcial of [{ prazoMaximoDias: 366 }, { quantidadeTotal: -1 }]) {
        const resposta = await comoAdmin(
          request(app.getHttpServer())
            .patch(`/api/equipamentos/${criado.id}`)
            .send(parcial),
        );
        expect(resposta.status).toBe(400);
      }
    });

    it('aumentar o total: o disponível acompanha a diferença', async () => {
      const criado = await cadastrar({ quantidadeTotal: 5 });
      await equipamentos.reservar(criado.id, 2); // disponível 3
      const resposta = await comoAdmin(
        request(app.getHttpServer())
          .patch(`/api/equipamentos/${criado.id}`)
          .send({ quantidadeTotal: 8 }),
      );
      const envelope = resposta.body as Envelope<Equipamento>;
      expect(resposta.status).toBe(200);
      expect(envelope.dados?.quantidadeTotal).toBe(8);
      expect(envelope.dados?.quantidadeDisponivel).toBe(6);
    });

    it('409 se o disponível ficaria negativo; no limite, aceita', async () => {
      const criado = await cadastrar({ quantidadeTotal: 5 });
      await equipamentos.reservar(criado.id, 3); // disponível 2, fora 3

      const recusado = await comoAdmin(
        request(app.getHttpServer())
          .patch(`/api/equipamentos/${criado.id}`)
          .send({ quantidadeTotal: 2 }),
      );
      expect(recusado.status).toBe(409);
      expect((await repositorio.buscarPorId(criado.id))?.quantidadeTotal).toBe(5);

      const aceito = await comoAdmin(
        request(app.getHttpServer())
          .patch(`/api/equipamentos/${criado.id}`)
          .send({ quantidadeTotal: 3 }),
      );
      const envelope = aceito.body as Envelope<Equipamento>;
      expect(aceito.status).toBe(200);
      expect(envelope.dados?.quantidadeDisponivel).toBe(0);
      expect(envelope.dados?.status).toBe(StatusEquipamento.Emprestado);
    });

    it('404 se o equipamento não existe', async () => {
      const resposta = await comoAdmin(
        request(app.getHttpServer())
          .patch('/api/equipamentos/nao-existe')
          .send({ nome: 'Novo' }),
      );
      expect(resposta.status).toBe(404);
    });
  });

  describe('PATCH /equipamentos/:id/ativo', () => {
    it('false com todas as unidades em casa: vira inativo e some do catálogo do professor', async () => {
      const criado = await cadastrar();
      const resposta = await comoAdmin(
        request(app.getHttpServer())
          .patch(`/api/equipamentos/${criado.id}/ativo`)
          .send({ ativo: false }),
      );
      const envelope = resposta.body as Envelope<Equipamento>;
      expect(resposta.status).toBe(200);
      expect(envelope.dados?.status).toBe(StatusEquipamento.Inativo);

      const comoUsuario = await comoProfessor(
        request(app.getHttpServer()).get(`/api/equipamentos/${criado.id}`),
      );
      expect(comoUsuario.status).toBe(404);
    });

    it('false com unidade emprestada: 409 e o status não muda', async () => {
      const criado = await cadastrar();
      await equipamentos.reservar(criado.id, 1);
      const resposta = await comoAdmin(
        request(app.getHttpServer())
          .patch(`/api/equipamentos/${criado.id}/ativo`)
          .send({ ativo: false }),
      );
      expect(resposta.status).toBe(409);
      expect((await repositorio.buscarPorId(criado.id))?.status).toBe(
        StatusEquipamento.Disponivel,
      );
    });

    it('true volta a disponivel', async () => {
      const criado = await cadastrar();
      await comoAdmin(
        request(app.getHttpServer())
          .patch(`/api/equipamentos/${criado.id}/ativo`)
          .send({ ativo: false }),
      );
      const resposta = await comoAdmin(
        request(app.getHttpServer())
          .patch(`/api/equipamentos/${criado.id}/ativo`)
          .send({ ativo: true }),
      );
      const envelope = resposta.body as Envelope<Equipamento>;
      expect(resposta.status).toBe(200);
      expect(envelope.dados?.status).toBe(StatusEquipamento.Disponivel);
    });

    it('400 sem ativo ou com valor que não é booleano', async () => {
      const criado = await cadastrar();
      for (const corpoInvalido of [{}, { ativo: 'sim' }]) {
        const resposta = await comoAdmin(
          request(app.getHttpServer())
            .patch(`/api/equipamentos/${criado.id}/ativo`)
            .send(corpoInvalido),
        );
        expect(resposta.status).toBe(400);
      }
    });

    it('404 se o equipamento não existe', async () => {
      const resposta = await comoAdmin(
        request(app.getHttpServer())
          .patch('/api/equipamentos/nao-existe/ativo')
          .send({ ativo: false }),
      );
      expect(resposta.status).toBe(404);
    });
  });
});