import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configurarApp } from './../src/common/configurar-app.js';
import { EquipamentosRepository } from './../src/equipamentos/equipamentos.repository.js';
import { ManutencoesService } from './../src/manutencoes/manutencoes.service.js';
import { EmprestimosRepository } from './../src/emprestimos/emprestimos.repository.js';

describe('API (e2e): balcão de empréstimos', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  let tokenAdmin: string;
  let tokenProfessor: string;

  let emprestimosRepository: EmprestimosRepository;
  let equipamentosRepository: EquipamentosRepository;
  let manutencoesService: ManutencoesService;

  const entrar = async (email: string, senha: string) =>
    (await http.post('/api/auth/login').send({ email, senha })).body.dados
      .tokenAcesso as string;

  const consultar = (codigo: string, token = tokenAdmin) =>
    http
      .get('/api/emprestimos/balcao/consulta')
      .query({ codigo })
      .set('Authorization', `Bearer ${token}`);

  const retirada = (codigo: string, token = tokenAdmin) =>
    http
      .post('/api/emprestimos/balcao/retirada')
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo });

  const devolucao = (dados: Record<string, unknown>, token = tokenAdmin) =>
    http
      .post('/api/emprestimos/balcao/devolucao')
      .set('Authorization', `Bearer ${token}`)
      .send(dados);

  const estoque = async (equipamentoId: string) => {
    const resposta = await http
      .get(`/api/equipamentos/${equipamentoId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    return resposta.body.dados.quantidadeDisponivel as number;
  };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();

    http = request(app.getHttpServer());

    emprestimosRepository = app.get(EmprestimosRepository);
    equipamentosRepository = app.get(EquipamentosRepository);
    manutencoesService = app.get(ManutencoesService);

    tokenAdmin = await entrar('admin@fab.com', 'admin123');
    tokenProfessor = await entrar('professor@fab.com', 'prof123');
  });

  beforeEach(async () => {
    await emprestimosRepository.redefinir();
    await equipamentosRepository.redefinir();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/emprestimos/balcao/consulta', () => {
    it('identifica um código de retirada', async () => {
      const resposta = await consultar('H3Q8ZW');

      expect(resposta.status).toBe(200);
      expect(resposta.body.dados.tipo).toBe('retirada');
      expect(resposta.body.dados.emprestimo.protocolo).toBe('EMP-2026-0040');
    });

    it('identifica um código de devolução', async () => {
      const resposta = await consultar('W4D7KC');

      expect(resposta.status).toBe(200);
      expect(resposta.body.dados.tipo).toBe('devolucao');
      expect(resposta.body.dados.emprestimo.protocolo).toBe('EMP-2026-0038');
    });

    it('normaliza espaços e letras minúsculas', async () => {
      const resposta = await consultar('  h3q8zw  ');

      expect(resposta.status).toBe(200);
      expect(resposta.body.dados.tipo).toBe('retirada');
    });

    it('404 para código desconhecido', async () => {
      const resposta = await consultar('XXXXXX');

      expect(resposta.status).toBe(404);
    });

    it('401 sem autenticação', async () => {
      const resposta = await http
        .get('/api/emprestimos/balcao/consulta')
        .query({ codigo: 'H3Q8ZW' });

      expect(resposta.status).toBe(401);
    });

    it('403 para usuário que não é administrador', async () => {
      const resposta = await consultar('H3Q8ZW', tokenProfessor);

      expect(resposta.status).toBe(403);
    });
  });

  describe('POST /api/emprestimos/balcao/retirada', () => {
    it('registra a retirada de um empréstimo aprovado', async () => {
      const resposta = await retirada('H3Q8ZW');

      expect(resposta.status).toBe(201);
      expect(resposta.body.dados.status).toBe('em_andamento');
      expect(resposta.body.dados.codigoRetirada).toBeFalsy();
      expect(resposta.body.dados.codigoDevolucao).toMatch(/^[A-Z0-9]{6}$/);
      expect(resposta.body.dados.dataRetiradaEfetiva).toBeTruthy();
    });

    it('não permite usar um código de devolução na retirada', async () => {
      const resposta = await retirada('W4D7KC');

      expect(resposta.status).toBe(409);
    });

    it('não permite reutilizar o código de retirada', async () => {
      const primeira = await retirada('H3Q8ZW');

      expect(primeira.status).toBe(201);

      const segunda = await retirada('H3Q8ZW');

      expect(segunda.status).toBe(404);
    });

    it('não altera o estoque ao registrar a retirada', async () => {
      const antes = await estoque('eqp-notebook-dell');

      const resposta = await retirada('H3Q8ZW');

      expect(resposta.status).toBe(201);
      expect(await estoque('eqp-notebook-dell')).toBe(antes);
    });

    it('400 para código ausente', async () => {
      const resposta = await http
        .post('/api/emprestimos/balcao/retirada')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({});

      expect(resposta.status).toBe(400);
    });
  });

  describe('POST /api/emprestimos/balcao/devolucao', () => {
    it('registra devolução sem avaria e libera o estoque', async () => {
      const antes = await estoque('eqp-projetor');

      const resposta = await devolucao({
        codigo: 'W4D7KC',
        houveAvaria: false,
      });

      expect(resposta.status).toBe(201);
      expect(resposta.body.dados.status).toBe('devolvido');
      expect(resposta.body.dados.houveAvaria).toBe(false);
      expect(resposta.body.dados.codigoDevolucao).toBeFalsy();
      expect(await estoque('eqp-projetor')).toBe(antes + 1);
    });

    it('registra avaria com observações e não libera o estoque', async () => {
      const antes = await estoque('eqp-impressora-3d');
      const avariasAntes = manutencoesService.listarAvariasDeDevolucao().length;

      const resposta = await devolucao({
        codigo: 'P8X2MJ',
        houveAvaria: true,
        observacoes: 'Equipamento apresentou falha durante o uso.',
      });

      expect(resposta.status).toBe(201);
      expect(resposta.body.dados.status).toBe('devolvido');
      expect(resposta.body.dados.houveAvaria).toBe(true);
      expect(resposta.body.dados.observacoesDevolucao).toBe(
        'Equipamento apresentou falha durante o uso.',
      );

      expect(await estoque('eqp-impressora-3d')).toBe(antes);

      const avarias = manutencoesService.listarAvariasDeDevolucao();

      expect(avarias).toHaveLength(avariasAntes + 1);
      expect(avarias[avarias.length - 1]).toMatchObject({
        emprestimoId: 'emp-2026-0044',
        equipamentoId: 'eqp-impressora-3d',
        quantidade: 1,
        observacoes: 'Equipamento apresentou falha durante o uso.',
        registradaPorId: 'usr-admin',
      });
    });

    it('400 quando existe avaria sem observações', async () => {
      const resposta = await devolucao({
        codigo: 'P8X2MJ',
        houveAvaria: true,
      });

      expect(resposta.status).toBe(400);
    });

    it('não permite usar código de retirada na devolução', async () => {
      const resposta = await devolucao({
        codigo: 'H3Q8ZW',
      });

      expect(resposta.status).toBe(409);
    });

    it('não permite reutilizar código de devolução', async () => {
      const primeira = await devolucao({
        codigo: 'W4D7KC',
        houveAvaria: false,
      });

      expect(primeira.status).toBe(201);

      const segunda = await devolucao({
        codigo: 'W4D7KC',
        houveAvaria: false,
      });

      expect(segunda.status).toBe(404);
    });

    it('400 para código ausente', async () => {
      const resposta = await http
        .post('/api/emprestimos/balcao/devolucao')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({});

      expect(resposta.status).toBe(400);
    });
  });
});
