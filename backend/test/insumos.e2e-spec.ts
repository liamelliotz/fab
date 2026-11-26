import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configurarApp } from './../src/common/configurar-app.js';
import { INSUMO_IDS } from './../src/common/seed/ids.js';
import { InsumosRepository } from './../src/insumos/insumos.repository.js';
import { MovimentacoesRepository } from './../src/insumos/movimentacoes.repository.js';

/**
 * /api/insumos (card D1): cadastro, consulta, edição e ativação. Todas as rotas são de admin.
 * Só 2 logins no beforeAll, porque o login aceita 5 tentativas por minuto por IP.
 * Antes de cada teste o seed é recarregado, então um teste nunca depende do outro.
 */
describe('API (e2e): cadastro de insumos', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let tokenAdmin: string;
  let tokenProfessor: string;
  let insumos: InsumosRepository;
  let movimentacoes: MovimentacoesRepository;

  const FILAMENTO = INSUMO_IDS.filamentoPla; // 2 em estoque, mínimo 3 (abaixo do mínimo)
  const ESTANHO = INSUMO_IDS.estanho; //        1,25 kg em estoque, mínimo 0,5
  const PINCEL = INSUMO_IDS.pincelQuadro; //    zerado, mínimo 10
  const TOTAL_NO_SEED = 6;

  type Metodo = 'get' | 'post' | 'patch';

  const chamar = (
    metodo: Metodo,
    caminho: string,
    token?: string,
    corpo?: unknown,
  ) => {
    let req = http[metodo](caminho);
    if (token) {
      req = req.set('Authorization', `Bearer ${token}`);
    }
    return corpo === undefined ? req : req.send(corpo as object);
  };

  const ler = (caminho: string, token: string = tokenAdmin) =>
    chamar('get', caminho, token);
  const cadastrar = (corpo: unknown, token: string = tokenAdmin) =>
    chamar('post', '/api/insumos', token, corpo);
  const editar = (id: string, corpo: unknown, token: string = tokenAdmin) =>
    chamar('patch', `/api/insumos/${id}`, token, corpo);
  const alterarAtivo = (
    id: string,
    corpo: unknown,
    token: string = tokenAdmin,
  ) => chamar('patch', `/api/insumos/${id}/ativo`, token, corpo);

  const corpo = (sobrescrever: Record<string, unknown> = {}) => ({
    nome: 'Cola quente (bastão)',
    categoria: 'ferragens',
    unidadeMedida: 'un',
    estoqueMinimo: 2,
    ...sobrescrever,
  });

  type Insumo = {
    id: string;
    nome: string;
    quantidadeAtual: number;
    estoqueMinimo: number;
    ativo: boolean;
    estoqueBaixo: boolean;
    fornecedor?: string;
  };
  const idsDe = (itens: Insumo[]) => itens.map((i) => i.id);

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

    insumos = modulo.get(InsumosRepository, { strict: false });
    movimentacoes = modulo.get(MovimentacoesRepository, { strict: false });

    tokenAdmin = await entrar('admin@fab.com', 'admin123');
    tokenProfessor = await entrar('professor@fab.com', 'prof123');
  });

  beforeEach(async () => {
    await insumos.redefinir();
    await movimentacoes.redefinir();
  });

  afterAll(async () => {
    await app.close();
  });

  it('401 sem token', async () => {
    expect((await chamar('get', '/api/insumos')).status).toBe(401);
    expect(
      (await chamar('post', '/api/insumos', undefined, corpo())).status,
    ).toBe(401);
  });

  describe('403: professor não acessa nenhuma rota de /insumos', () => {
    it.each<[Metodo, string, object | undefined]>([
      ['get', '/api/insumos', undefined],
      ['get', `/api/insumos/${FILAMENTO}`, undefined],
      ['get', '/api/insumos/id-que-nao-existe', undefined],
      ['post', '/api/insumos', corpo()],
      ['patch', `/api/insumos/${FILAMENTO}`, { fornecedor: 'Outro' }],
      ['patch', `/api/insumos/${FILAMENTO}/ativo`, { ativo: false }],
    ])('%s %s', async (metodo, caminho, enviado) => {
      const resposta = await chamar(metodo, caminho, tokenProfessor, enviado);
      expect(resposta.status).toBe(403);
      expect(resposta.body.sucesso).toBe(false);
    });

    it('e nada foi gravado pelas tentativas de escrita', async () => {
      await cadastrar(corpo(), tokenProfessor);
      await editar(FILAMENTO, { fornecedor: 'Outro' }, tokenProfessor);
      await alterarAtivo(FILAMENTO, { ativo: false }, tokenProfessor);
      expect(await insumos.contar()).toBe(TOTAL_NO_SEED);
      const filamento = await insumos.buscarPorId(FILAMENTO);
      expect(filamento?.fornecedor).toBe('3D Fila');
      expect(filamento?.ativo).toBe(true);
    });
  });

  describe('GET /api/insumos', () => {
    it('200: só os ativos, em ordem alfabética, com estoqueBaixo calculado', async () => {
      const resposta = await ler('/api/insumos');
      expect(resposta.status).toBe(200);
      const { itens, totalItens } = resposta.body.dados as {
        itens: Insumo[];
        totalItens: number;
      };
      expect(totalItens).toBe(TOTAL_NO_SEED);

      const nomes = itens.map((i) => i.nome);
      expect(nomes).toEqual(
        [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      );

      const porId = new Map(itens.map((i) => [i.id, i]));
      expect(porId.get(FILAMENTO)?.estoqueBaixo).toBe(true);
      expect(porId.get(PINCEL)?.estoqueBaixo).toBe(true);
      expect(porId.get(ESTANHO)?.estoqueBaixo).toBe(false);
      for (const item of itens) {
        expect(typeof item.estoqueBaixo).toBe('boolean');
      }
    });

    it('apenasARepor=true traz só o filamento e o pincel', async () => {
      const resposta = await ler('/api/insumos?apenasARepor=true');
      expect(resposta.status).toBe(200);
      expect(idsDe(resposta.body.dados.itens).sort()).toEqual(
        [FILAMENTO, PINCEL].sort(),
      );
    });

    it('filtra por categoria', async () => {
      const resposta = await ler('/api/insumos?categoria=eletronica');
      expect(resposta.status).toBe(200);
      expect(resposta.body.dados.totalItens).toBe(2);
    });

    it('busca no nome e no fornecedor, sem diferenciar maiúsculas', async () => {
      // "resma" só aparece no nome do papel ("papel" também está no fornecedor do pincel).
      const porNome = await ler('/api/insumos?busca=RESMA');
      expect(idsDe(porNome.body.dados.itens)).toEqual([INSUMO_IDS.papelA4]);

      const porFornecedor = await ler(
        `/api/insumos?busca=${encodeURIComponent('Eletrônica Macapá')}`,
      );
      expect(idsDe(porFornecedor.body.dados.itens).sort()).toEqual(
        [ESTANHO, INSUMO_IDS.resistores].sort(),
      );
    });

    it('desativado some da lista; incluirInativos=true traz de volta', async () => {
      await alterarAtivo(ESTANHO, { ativo: false });

      const padrao = await ler('/api/insumos?itensPorPagina=100');
      expect(idsDe(padrao.body.dados.itens)).not.toContain(ESTANHO);
      expect(padrao.body.dados.totalItens).toBe(TOTAL_NO_SEED - 1);

      const todos = await ler(
        '/api/insumos?incluirInativos=true&itensPorPagina=100',
      );
      expect(todos.body.dados.totalItens).toBe(TOTAL_NO_SEED);
      const estanho = (todos.body.dados.itens as Insumo[]).find(
        (i) => i.id === ESTANHO,
      );
      expect(estanho?.ativo).toBe(false);
    });

    it('pagina: itensPorPagina=4 devolve 4 na primeira e 2 na segunda', async () => {
      const primeira = await ler('/api/insumos?pagina=1&itensPorPagina=4');
      expect(primeira.body.dados.itens).toHaveLength(4);
      expect(primeira.body.dados).toMatchObject({
        totalItens: TOTAL_NO_SEED,
        totalPaginas: 2,
        temProxima: true,
        temAnterior: false,
      });
      const segunda = await ler('/api/insumos?pagina=2&itensPorPagina=4');
      expect(segunda.body.dados.itens).toHaveLength(2);
      expect(segunda.body.dados.temProxima).toBe(false);
    });

    describe('400: filtro inválido', () => {
      it.each([
        ['categoria desconhecida', 'categoria=banana'],
        ['apenasARepor que não é true nem false', 'apenasARepor=talvez'],
        ['incluirInativos que não é true nem false', 'incluirInativos=sim'],
        ['itensPorPagina acima do máximo', 'itensPorPagina=500'],
      ])('%s', async (_nome, consulta) => {
        const resposta = await ler(`/api/insumos?${consulta}`);
        expect(resposta.status).toBe(400);
        expect(resposta.body.sucesso).toBe(false);
      });
    });
  });

  describe('GET /api/insumos/:id', () => {
    it('200: devolve o insumo com estoqueBaixo', async () => {
      const resposta = await ler(`/api/insumos/${FILAMENTO}`);
      expect(resposta.status).toBe(200);
      expect(resposta.body.dados).toMatchObject({
        id: FILAMENTO,
        quantidadeAtual: 2,
        estoqueMinimo: 3,
        estoqueBaixo: true,
        ativo: true,
      });
    });

    it('404: insumo que não existe', async () => {
      const resposta = await ler('/api/insumos/id-que-nao-existe');
      expect(resposta.status).toBe(404);
      expect(resposta.body.sucesso).toBe(false);
    });
  });

  describe('POST /api/insumos', () => {
    it('201: cadastra sem saldo e sem movimentação', async () => {
      const resposta = await cadastrar(corpo());
      expect(resposta.status).toBe(201);
      expect(resposta.body.sucesso).toBe(true);
      expect(resposta.body.mensagem).toBe('Insumo cadastrado.');
      expect(resposta.body.dados).toMatchObject({
        nome: 'Cola quente (bastão)',
        categoria: 'ferragens',
        unidadeMedida: 'un',
        quantidadeAtual: 0,
        estoqueMinimo: 2,
        ativo: true,
        estoqueBaixo: true,
      });
      expect(
        await movimentacoes.listarDoInsumo(resposta.body.dados.id),
      ).toHaveLength(0);
    });

    it('201: quantidadeInicial 5 gera uma movimentação de entrada de 5', async () => {
      const resposta = await cadastrar(corpo({ quantidadeInicial: 5 }));
      expect(resposta.status).toBe(201);
      expect(resposta.body.dados.quantidadeAtual).toBe(5);

      const doInsumo = await movimentacoes.listarDoInsumo(
        resposta.body.dados.id,
      );
      expect(doInsumo).toHaveLength(1);
      expect(doInsumo[0]).toMatchObject({
        tipo: 'entrada',
        motivo: 'ajuste_positivo',
        quantidade: 5,
        saldoApos: 5,
        responsavelId: 'usr-admin',
      });
    });

    it('quantidadeAtual e responsavelId no corpo são ignorados', async () => {
      const resposta = await cadastrar(
        corpo({
          quantidadeInicial: 5,
          quantidadeAtual: 999,
          responsavelId: 'usr-professor',
        }),
      );
      expect(resposta.status).toBe(201);
      expect(resposta.body.dados.quantidadeAtual).toBe(5);
      const [entrada] = await movimentacoes.listarDoInsumo(
        resposta.body.dados.id,
      );
      expect(entrada.responsavelId).toBe('usr-admin');
    });

    it('201: aceita saldo decimal e validade', async () => {
      const resposta = await cadastrar(
        corpo({
          nome: 'Solda em pasta',
          unidadeMedida: 'kg',
          quantidadeInicial: 0.25,
          estoqueMinimo: 0.1,
          validade: '2027-03-31',
          fornecedor: 'Eletrônica Macapá',
        }),
      );
      expect(resposta.status).toBe(201);
      expect(resposta.body.dados).toMatchObject({
        quantidadeAtual: 0.25,
        validade: '2027-03-31',
        estoqueBaixo: false,
      });
    });

    it('409: nome repetido com outra caixa', async () => {
      const resposta = await cadastrar(
        corpo({ nome: 'ESTANHO PARA SOLDA 60/40' }),
      );
      expect(resposta.status).toBe(409);
      expect(resposta.body.sucesso).toBe(false);
      expect(await insumos.contar()).toBe(TOTAL_NO_SEED);
    });

    it('409: nome repetido com espaços nas pontas', async () => {
      const resposta = await cadastrar(
        corpo({ nome: '  estanho para solda 60/40  ' }),
      );
      expect(resposta.status).toBe(409);
    });

    it('409: o mesmo nome 2 vezes seguidas', async () => {
      expect((await cadastrar(corpo())).status).toBe(201);
      expect(
        (await cadastrar(corpo({ nome: 'COLA QUENTE (BASTÃO)' }))).status,
      ).toBe(409);
    });

    describe('400: corpo inválido', () => {
      it.each([
        ['nome vazio', { nome: '' }],
        ['nome só com espaços', { nome: '   ' }],
        ['nome ausente', { nome: undefined }],
        ['categoria inválida', { categoria: 'comida' }],
        ['unidadeMedida inválida', { unidadeMedida: 'tonelada' }],
        ['estoqueMinimo negativo', { estoqueMinimo: -1 }],
        ['estoqueMinimo ausente', { estoqueMinimo: undefined }],
        ['estoqueMinimo em texto', { estoqueMinimo: 'dois' }],
        ['quantidadeInicial negativa', { quantidadeInicial: -5 }],
        [
          'quantidadeInicial com 4 casas decimais',
          { quantidadeInicial: 1.2345 },
        ],
        ['validade mal formatada', { validade: '31/03/2027' }],
        ['validade que não existe no calendário', { validade: '2027-02-30' }],
      ])('%s', async (_nome, sobrescrever) => {
        const resposta = await cadastrar(corpo(sobrescrever));
        expect(resposta.status).toBe(400);
        expect(resposta.body.sucesso).toBe(false);
        expect(await insumos.contar()).toBe(TOTAL_NO_SEED);
      });
    });
  });

  describe('PATCH /api/insumos/:id', () => {
    it('200: muda os campos informados e recalcula estoqueBaixo', async () => {
      const resposta = await editar(FILAMENTO, {
        fornecedor: 'Nova Fila 3D',
        estoqueMinimo: 1,
      });
      expect(resposta.status).toBe(200);
      expect(resposta.body.mensagem).toBe('Insumo atualizado.');
      expect(resposta.body.dados).toMatchObject({
        id: FILAMENTO,
        fornecedor: 'Nova Fila 3D',
        estoqueMinimo: 1,
        quantidadeAtual: 2,
        estoqueBaixo: false,
      });
    });

    it('enviar quantidadeAtual não muda o saldo', async () => {
      const resposta = await editar(FILAMENTO, {
        quantidadeAtual: 999,
        fornecedor: 'Nova Fila 3D',
      });
      expect(resposta.status).toBe(200);
      expect(resposta.body.dados.quantidadeAtual).toBe(2);
      expect(
        (await ler(`/api/insumos/${FILAMENTO}`)).body.dados.quantidadeAtual,
      ).toBe(2);
    });

    it('um corpo só com quantidadeAtual não altera nada e não cria movimentação', async () => {
      const antes = await movimentacoes.contar();
      const resposta = await editar(ESTANHO, { quantidadeAtual: 999 });
      expect(resposta.status).toBe(200);
      expect(resposta.body.dados.quantidadeAtual).toBe(1.25);
      expect(await movimentacoes.contar()).toBe(antes);
    });

    it('ativo no corpo é ignorado (para isso existe PATCH /:id/ativo)', async () => {
      const resposta = await editar(ESTANHO, {
        ativo: false,
        localizacao: 'Gaveta 9',
      });
      expect(resposta.status).toBe(200);
      expect(resposta.body.dados).toMatchObject({
        ativo: true,
        localizacao: 'Gaveta 9',
      });
    });

    it('200: trocar só a caixa do próprio nome', async () => {
      const resposta = await editar(ESTANHO, {
        nome: 'ESTANHO PARA SOLDA 60/40',
      });
      expect(resposta.status).toBe(200);
      expect(resposta.body.dados.nome).toBe('ESTANHO PARA SOLDA 60/40');
    });

    it('409: nome de outro insumo, com outra caixa', async () => {
      const resposta = await editar(PINCEL, {
        nome: 'estanho para solda 60/40',
      });
      expect(resposta.status).toBe(409);
      expect((await insumos.buscarPorId(PINCEL))?.nome).toBe(
        'Pincel para quadro branco (azul)',
      );
    });

    it('404: insumo que não existe', async () => {
      const resposta = await editar('id-que-nao-existe', {
        fornecedor: 'Outro',
      });
      expect(resposta.status).toBe(404);
    });

    describe('400: corpo inválido', () => {
      it.each([
        ['nome vazio', { nome: '' }],
        ['categoria inválida', { categoria: 'comida' }],
        ['estoqueMinimo negativo', { estoqueMinimo: -1 }],
        ['estoqueMinimo com 4 casas decimais', { estoqueMinimo: 0.1234 }],
      ])('%s', async (_nome, enviado) => {
        const resposta = await editar(ESTANHO, enviado);
        expect(resposta.status).toBe(400);
        expect(resposta.body.sucesso).toBe(false);
      });
    });
  });

  describe('PATCH /api/insumos/:id/ativo', () => {
    it('200: desativa e reativa', async () => {
      const desativado = await alterarAtivo(ESTANHO, { ativo: false });
      expect(desativado.status).toBe(200);
      expect(desativado.body.dados.ativo).toBe(false);

      const reativado = await alterarAtivo(ESTANHO, { ativo: true });
      expect(reativado.status).toBe(200);
      expect(reativado.body.dados.ativo).toBe(true);
    });

    it('desativado nunca é "a repor", mesmo abaixo do mínimo', async () => {
      const resposta = await alterarAtivo(FILAMENTO, { ativo: false });
      expect(resposta.body.dados.estoqueBaixo).toBe(false);
      const aRepor = await ler(
        '/api/insumos?apenasARepor=true&incluirInativos=true',
      );
      expect(idsDe(aRepor.body.dados.itens)).toEqual([PINCEL]);
    });

    it('o saldo não muda ao desativar', async () => {
      const resposta = await alterarAtivo(FILAMENTO, { ativo: false });
      expect(resposta.body.dados.quantidadeAtual).toBe(2);
    });

    it('404: insumo que não existe', async () => {
      const resposta = await alterarAtivo('id-que-nao-existe', {
        ativo: false,
      });
      expect(resposta.status).toBe(404);
    });

    describe('400: corpo inválido', () => {
      it.each([
        ['ativo em texto', { ativo: 'sim' }],
        ['ativo ausente', {}],
      ])('%s', async (_nome, enviado) => {
        const resposta = await alterarAtivo(ESTANHO, enviado);
        expect(resposta.status).toBe(400);
        expect(resposta.body.sucesso).toBe(false);
      });
    });
  });
});
