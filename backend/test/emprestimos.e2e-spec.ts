import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configurarApp } from './../src/common/configurar-app.js';
import { hojeIso, somarDias } from './../src/common/utils/data.util.js';

/**
 * POST /api/emprestimos (card C2): solicitar empréstimo.
 * Só 2 logins no beforeAll, porque o login aceita 5 tentativas por minuto por IP.
 */
describe('API (e2e): solicitar empréstimo', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let tokenProfessor: string;
  let tokenJoao: string;

  const MULTIMETRO = 'eqp-multimetro';
  const PROJETOR = 'eqp-projetor';
  const PARAFUSADEIRA = 'eqp-parafusadeira';
  const IMPRESSORA = 'eqp-impressora-3d';

  const retirada = somarDias(hojeIso(), 1);

  const corpo = (sobrescrever: Record<string, unknown> = {}) => ({
    itens: [{ equipamentoId: MULTIMETRO, quantidade: 1 }],
    justificativa: 'Aula prática de eletrônica',
    dataPrevistaRetirada: retirada,
    dataPrevistaDevolucao: somarDias(retirada, 2),
    ...sobrescrever,
  });

  const solicitar = (token: string, dados: unknown) =>
    http
      .post('/api/emprestimos')
      .set('Authorization', `Bearer ${token}`)
      .send(dados as object);

  const estoqueDoMultimetro = async () =>
    (
      await http
        .get(`/api/equipamentos/${MULTIMETRO}`)
        .set('Authorization', `Bearer ${tokenProfessor}`)
    ).body.dados.quantidadeDisponivel as number;

  const entrar = async (email: string, senha: string) =>
    (await http.post('/api/auth/login').send({ email, senha })).body.dados
      .tokenAcesso as string;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
    http = request(app.getHttpServer());

    tokenProfessor = await entrar('professor@fab.com', 'prof123');
    tokenJoao = await entrar('joao@escola.br', 'prof123');
  });

  afterAll(async () => {
    await app.close();
  });

  it('201: grava pendente, com protocolo, e o responsável vem do token', async () => {
    const resposta = await solicitar(tokenProfessor, corpo());
    expect(resposta.status).toBe(201);
    expect(resposta.body.dados.status).toBe('pendente');
    expect(resposta.body.dados.protocolo).toMatch(/^EMP-\d{4}-\d{4}$/);
    expect(resposta.body.dados.solicitante.id).toBe('usr-professor');
    expect(resposta.body.dados.responsavel.id).toBe('usr-professor');
    expect(resposta.body.dados.historico[0].tipo).toBe('solicitado');
  });

  it('solicitanteId e responsavelId no corpo são ignorados', async () => {
    const resposta = await solicitar(
      tokenProfessor,
      corpo({ solicitanteId: 'usr-admin', responsavelId: 'usr-admin' }),
    );
    expect(resposta.status).toBe(201);
    expect(resposta.body.dados.solicitante.id).toBe('usr-professor');
    expect(resposta.body.dados.responsavel.id).toBe('usr-professor');
  });

  it('o estoque não muda depois de solicitar', async () => {
    const antes = await estoqueDoMultimetro();
    const resposta = await solicitar(
      tokenProfessor,
      corpo({ itens: [{ equipamentoId: MULTIMETRO, quantidade: 2 }] }),
    );
    expect(resposta.status).toBe(201);
    expect(await estoqueDoMultimetro()).toBe(antes);
  });

  it('401 sem token', async () => {
    const resposta = await http.post('/api/emprestimos').send(corpo());
    expect(resposta.status).toBe(401);
  });

  describe('400: corpo inválido', () => {
    it.each([
      ['itens vazios', { itens: [] }],
      [
        'equipamento repetido',
        {
          itens: [
            { equipamentoId: MULTIMETRO, quantidade: 1 },
            { equipamentoId: MULTIMETRO, quantidade: 1 },
          ],
        },
      ],
      [
        'quantidade 0',
        { itens: [{ equipamentoId: MULTIMETRO, quantidade: 0 }] },
      ],
      [
        'quantidade 1.5',
        { itens: [{ equipamentoId: MULTIMETRO, quantidade: 1.5 }] },
      ],
      ['justificativa curta', { justificativa: 'curta' }],
      ['data mal formatada', { dataPrevistaRetirada: '20/11/2026' }],
    ])('%s', async (_nome, sobrescrever) => {
      const resposta = await solicitar(tokenProfessor, corpo(sobrescrever));
      expect(resposta.status).toBe(400);
      expect(resposta.body.sucesso).toBe(false);
    });
  });

  it('400: retirada no passado', async () => {
    const resposta = await solicitar(
      tokenProfessor,
      corpo({ dataPrevistaRetirada: somarDias(hojeIso(), -1) }),
    );
    expect(resposta.status).toBe(400);
  });

  it('400: devolução antes da retirada', async () => {
    const resposta = await solicitar(
      tokenProfessor,
      corpo({ dataPrevistaDevolucao: somarDias(retirada, -1) }),
    );
    expect(resposta.status).toBe(400);
  });

  it('400: Projetor (prazo 3) por 5 dias informa a data limite', async () => {
    const resposta = await solicitar(
      tokenProfessor,
      corpo({
        itens: [{ equipamentoId: PROJETOR, quantidade: 1 }],
        dataPrevistaDevolucao: somarDias(retirada, 5),
      }),
    );
    expect(resposta.status).toBe(400);
    expect(JSON.stringify(resposta.body)).toContain(somarDias(retirada, 3));
  });

  it('409: Impressora 3D sem habilitação (João)', async () => {
    const resposta = await solicitar(
      tokenJoao,
      corpo({ itens: [{ equipamentoId: IMPRESSORA, quantidade: 1 }] }),
    );
    expect(resposta.status).toBe(409);
  });

  it('201: Impressora 3D com habilitação (professor)', async () => {
    const resposta = await solicitar(
      tokenProfessor,
      corpo({ itens: [{ equipamentoId: IMPRESSORA, quantidade: 1 }] }),
    );
    expect(resposta.status).toBe(201);
  });

  it('409: equipamento em manutenção', async () => {
    const resposta = await solicitar(
      tokenProfessor,
      corpo({ itens: [{ equipamentoId: PARAFUSADEIRA, quantidade: 1 }] }),
    );
    expect(resposta.status).toBe(409);
  });

  it('404: equipamento inexistente', async () => {
    const resposta = await solicitar(
      tokenProfessor,
      corpo({ itens: [{ equipamentoId: 'eqp-nao-existe', quantidade: 1 }] }),
    );
    expect(resposta.status).toBe(404);
  });
});
