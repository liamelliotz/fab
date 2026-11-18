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

/**
 * GET /api/emprestimos, /meus e /:id (card C3): listagens e detalhe.
 * Sobe a própria aplicação (seed novo), para as contagens do card não serem alteradas
 * pelos pedidos que os testes do C2 criam. Só 3 logins no beforeAll (limite de 5 por minuto).
 */
describe('API (e2e): listagens e detalhe de empréstimo', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let tokenProfessor: string;
  let tokenCarlos: string;
  let tokenAdmin: string;
  let idsDoProfessor: string[];

  type Pedido = {
    id: string;
    protocolo: string;
    status: string;
    dataSolicitacao: string;
    solicitante: { id: string } | null;
    responsavel: { id: string } | null;
    transferenciaPendente?: { para: { id: string } | null };
  };

  const ler = (caminho: string, token?: string) => {
    const req = http.get(caminho);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  const protocolosDe = (itens: Pedido[]) => itens.map((i) => i.protocolo);

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
    tokenCarlos = await entrar('carlos@escola.br', 'prof123');
    tokenAdmin = await entrar('admin@fab.com', 'admin123');

    const meus = await ler('/api/emprestimos/meus', tokenProfessor);
    idsDoProfessor = (meus.body.dados.itens as Pedido[]).map((i) => i.id);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/emprestimos/meus', () => {
    it('401 sem token', async () => {
      expect((await ler('/api/emprestimos/meus')).status).toBe(401);
    });

    it('o Professor vê os 3 pedidos dele, dos mais recentes para os mais antigos', async () => {
      const resposta = await ler('/api/emprestimos/meus', tokenProfessor);
      expect(resposta.status).toBe(200);
      const { itens, totalItens, totalPaginas } = resposta.body.dados;
      expect(totalItens).toBe(3);
      expect(totalPaginas).toBe(1);
      expect(protocolosDe(itens).sort()).toEqual([
        'EMP-2026-0038',
        'EMP-2026-0040',
        'EMP-2026-0044',
      ]);
      const datas = (itens as Pedido[]).map((i) => Date.parse(i.dataSolicitacao));
      expect(datas).toEqual([...datas].sort((a, b) => b - a));
    });

    it('só traz pedidos em que o Professor participa', async () => {
      const resposta = await ler('/api/emprestimos/meus', tokenProfessor);
      for (const pedido of resposta.body.dados.itens as Pedido[]) {
        const participa =
          pedido.solicitante?.id === 'usr-professor' ||
          pedido.responsavel?.id === 'usr-professor' ||
          pedido.transferenciaPendente?.para?.id === 'usr-professor';
        expect(participa).toBe(true);
      }
    });

    it('troca os ids por objetos resumidos, sem dados sensíveis', async () => {
      const resposta = await ler('/api/emprestimos/meus', tokenProfessor);
      const [primeiro] = resposta.body.dados.itens;
      expect(primeiro.solicitante).toMatchObject({ nome: expect.any(String) });
      expect(primeiro).not.toHaveProperty('solicitanteId');
      expect(JSON.stringify(resposta.body)).not.toMatch(/senha|cpf/i);
    });

    it('pagina: itensPorPagina=2 devolve 2 na primeira e 1 na segunda', async () => {
      const primeira = await ler(
        '/api/emprestimos/meus?pagina=1&itensPorPagina=2',
        tokenProfessor,
      );
      expect(primeira.body.dados.itens).toHaveLength(2);
      expect(primeira.body.dados).toMatchObject({
        totalItens: 3,
        totalPaginas: 2,
        temProxima: true,
        temAnterior: false,
      });
      const segunda = await ler(
        '/api/emprestimos/meus?pagina=2&itensPorPagina=2',
        tokenProfessor,
      );
      expect(segunda.body.dados.itens).toHaveLength(1);
      expect(segunda.body.dados.temProxima).toBe(false);
    });

    it('o Carlos não vê os pedidos do Professor', async () => {
      const resposta = await ler('/api/emprestimos/meus', tokenCarlos);
      expect(resposta.status).toBe(200);
      const idsDoCarlos = (resposta.body.dados.itens as Pedido[]).map((i) => i.id);
      for (const id of idsDoProfessor) {
        expect(idsDoCarlos).not.toContain(id);
      }
    });
  });

  describe('GET /api/emprestimos/:id', () => {
    it('401 sem token', async () => {
      const resposta = await ler(`/api/emprestimos/${idsDoProfessor[0]}`);
      expect(resposta.status).toBe(401);
    });

    it('200: o Professor abre os pedidos dele', async () => {
      for (const id of idsDoProfessor) {
        const resposta = await ler(`/api/emprestimos/${id}`, tokenProfessor);
        expect(resposta.status).toBe(200);
        expect(resposta.body.dados.id).toBe(id);
      }
    });

    it('403: o Carlos não abre pedido do Professor', async () => {
      for (const id of idsDoProfessor) {
        const resposta = await ler(`/api/emprestimos/${id}`, tokenCarlos);
        expect(resposta.status).toBe(403);
        expect(resposta.body.sucesso).toBe(false);
      }
    });

    it('200: o admin abre qualquer pedido', async () => {
      for (const id of idsDoProfessor) {
        const resposta = await ler(`/api/emprestimos/${id}`, tokenAdmin);
        expect(resposta.status).toBe(200);
      }
    });

    it('404: pedido que não existe', async () => {
      const resposta = await ler('/api/emprestimos/id-que-nao-existe', tokenProfessor);
      expect(resposta.status).toBe(404);
    });
  });

  describe('GET /api/emprestimos (admin)', () => {
    it('401 sem token', async () => {
      expect((await ler('/api/emprestimos')).status).toBe(401);
    });

    it('403 para quem não é admin', async () => {
      expect((await ler('/api/emprestimos', tokenProfessor)).status).toBe(403);
      expect((await ler('/api/emprestimos', tokenCarlos)).status).toBe(403);
    });

    it('o admin vê os 10 pedidos, dos mais recentes para os mais antigos', async () => {
      const resposta = await ler('/api/emprestimos?itensPorPagina=100', tokenAdmin);
      expect(resposta.status).toBe(200);
      expect(resposta.body.dados.totalItens).toBe(10);
      expect(resposta.body.dados.itens).toHaveLength(10);
      const datas = (resposta.body.dados.itens as Pedido[]).map((i) =>
        Date.parse(i.dataSolicitacao),
      );
      expect(datas).toEqual([...datas].sort((a, b) => b - a));
    });

    it('atrasadosApenas=true traz só o EMP-2026-0037', async () => {
      const resposta = await ler('/api/emprestimos?atrasadosApenas=true', tokenAdmin);
      expect(resposta.status).toBe(200);
      expect(resposta.body.dados.totalItens).toBe(1);
      expect(protocolosDe(resposta.body.dados.itens)).toEqual(['EMP-2026-0037']);
      expect(resposta.body.dados.itens[0].status).toBe('atrasado');
    });

    it('status=atrasado dá o mesmo resultado, e em_andamento não traz o atrasado', async () => {
      const atrasado = await ler('/api/emprestimos?status=atrasado', tokenAdmin);
      expect(protocolosDe(atrasado.body.dados.itens)).toEqual(['EMP-2026-0037']);

      const emAndamento = await ler(
        '/api/emprestimos?status=em_andamento&itensPorPagina=100',
        tokenAdmin,
      );
      expect(emAndamento.status).toBe(200);
      expect(protocolosDe(emAndamento.body.dados.itens)).not.toContain(
        'EMP-2026-0037',
      );
    });

    it('solicitanteId filtra pelos pedidos de quem abriu', async () => {
      const resposta = await ler(
        '/api/emprestimos?solicitanteId=usr-professor&itensPorPagina=100',
        tokenAdmin,
      );
      expect(resposta.status).toBe(200);
      expect(resposta.body.dados.totalItens).toBeGreaterThan(0);
      for (const pedido of resposta.body.dados.itens as Pedido[]) {
        expect(pedido.solicitante?.id).toBe('usr-professor');
      }
    });

    it('pagina com o padrão de 10 itens', async () => {
      const resposta = await ler('/api/emprestimos?pagina=2&itensPorPagina=4', tokenAdmin);
      expect(resposta.status).toBe(200);
      expect(resposta.body.dados).toMatchObject({
        paginaAtual: 2,
        itensPorPagina: 4,
        totalItens: 10,
        totalPaginas: 3,
        temAnterior: true,
        temProxima: true,
      });
    });

    describe('400: filtro inválido', () => {
      it.each([
        ['status desconhecido', 'status=banana'],
        ['itensPorPagina acima do máximo', 'itensPorPagina=500'],
        ['dataInicio mal formatada', 'dataInicio=17/11/2026'],
        ['atrasadosApenas que não é true nem false', 'atrasadosApenas=talvez'],
        ['dataFim antes de dataInicio', 'dataInicio=2026-11-10&dataFim=2026-11-01'],
      ])('%s', async (_nome, consulta) => {
        const resposta = await ler(`/api/emprestimos?${consulta}`, tokenAdmin);
        expect(resposta.status).toBe(400);
        expect(resposta.body.sucesso).toBe(false);
      });
    });
  });
});