import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configurarApp } from './../src/common/configurar-app.js';

/**
 * Fluxo base da API, do jeito que o front usa: entrar, ler os próprios dados e listar o acervo.
 * Cada módulo novo acrescenta o seu arquivo test/<modulo>.e2e-spec.ts (não edite este).
 *
 * ATENÇÃO: o login aceita 5 tentativas por minuto por IP. Entre uma vez no beforeAll e
 * reaproveite o token, como abaixo.
 */
describe('API (e2e): login e acervo', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let tokenAdmin: string;
  let tokenProfessor: string;

  const entrar = (email: string, senha: string) =>
    http.post('/api/auth/login').send({ email, senha });

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modulo.createNestApplication();
    configurarApp(app); // mesma configuração do main.ts
    await app.init();
    http = request(app.getHttpServer());

    tokenAdmin = (await entrar('admin@fab.com', 'admin123')).body.dados
      .tokenAcesso;
    tokenProfessor = (await entrar('professor@fab.com', 'prof123')).body.dados
      .tokenAcesso;
  });

  afterAll(async () => {
    await app.close();
  });

  it('login devolve o envelope com token e usuário, sem a senha', async () => {
    const resposta = await entrar('admin@fab.com', 'admin123');
    expect(resposta.status).toBe(200);
    expect(resposta.body).toMatchObject({
      sucesso: true,
      mensagem: 'Login realizado.',
      erros: [],
      dados: {
        tipoToken: 'Bearer',
        expiraEm: 28800,
        usuario: { email: 'admin@fab.com', perfil: 'admin' },
      },
    });
    expect(resposta.body.dados.tokenAcesso.split('.')).toHaveLength(3);
    expect(JSON.stringify(resposta.body)).not.toMatch(/senha/i);
  });

  it('senha errada: 401 no envelope de erro', async () => {
    const resposta = await entrar('admin@fab.com', 'senha-errada');
    expect(resposta.status).toBe(401);
    expect(resposta.body).toMatchObject({
      sucesso: false,
      mensagem: 'E-mail ou senha incorretos.',
      dados: null,
    });
  });

  it('corpo inválido: 400 com a lista de campos', async () => {
    const resposta = await http
      .post('/api/auth/login')
      .send({ email: 'nao-e-email' });
    expect(resposta.status).toBe(400);
    expect(resposta.body.mensagem).toBe('Dados inválidos.');
    expect(resposta.body.erros).toEqual(
      expect.arrayContaining(['Informe um e-mail válido.', 'Informe a senha.']),
    );
  });

  it('rota protegida sem token ou com token falso: 401', async () => {
    expect((await http.get('/api/equipamentos')).status).toBe(401);
    // Token "alg: none", como o do modo demonstração do front: tem de ser recusado.
    const falso =
      Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url') +
      '.' +
      Buffer.from('{"sub":"usr-admin","perfil":"admin"}').toString(
        'base64url',
      ) +
      '.demo';
    const resposta = await http
      .get('/api/equipamentos')
      .set('Authorization', `Bearer ${falso}`);
    expect(resposta.status).toBe(401);
    expect(resposta.body.sucesso).toBe(false);
  });

  it('GET /auth/me devolve quem está logado', async () => {
    const resposta = await http
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenProfessor}`);
    expect(resposta.status).toBe(200);
    expect(resposta.body.dados).toMatchObject({
      id: 'usr-professor',
      email: 'professor@fab.com',
      perfil: 'usuario',
      habilitacoes: ['eqp-impressora-3d'],
    });
    expect(resposta.body.dados).not.toHaveProperty('senhaHash');
  });

  it('GET /equipamentos vem paginado e converte a query string', async () => {
    const resposta = await http
      .get('/api/equipamentos?pagina=1&itensPorPagina=3&apenasDisponiveis=true')
      .set('Authorization', `Bearer ${tokenProfessor}`);
    expect(resposta.status).toBe(200);
    expect(resposta.body.dados).toMatchObject({
      paginaAtual: 1,
      itensPorPagina: 3,
      temAnterior: false,
      temProxima: true,
    });
    expect(resposta.body.dados.itens).toHaveLength(3);
    expect(resposta.body.dados.itens[0]).toHaveProperty('codigoPatrimonio');
    expect(resposta.body.dados.itens[0]).toHaveProperty('prazoMaximoDias');
  });

  it('GET /equipamentos recusa filtro inválido (400)', async () => {
    const resposta = await http
      .get('/api/equipamentos?categoria=consumivel&itensPorPagina=500')
      .set('Authorization', `Bearer ${tokenProfessor}`);
    expect(resposta.status).toBe(400);
    expect(resposta.body.erros).toEqual(
      expect.arrayContaining([
        'categoria inválida.',
        'itensPorPagina deve ser no máximo 100.',
      ]),
    );
  });

  it('o admin vê os inativos; o professor não', async () => {
    const total = async (token: string) =>
      (
        await http
          .get('/api/equipamentos?itensPorPagina=100')
          .set('Authorization', `Bearer ${token}`)
      ).body.dados.totalItens;
    expect(await total(tokenAdmin)).toBe(10);
    expect(await total(tokenProfessor)).toBe(9);
  });

  it('GET /equipamentos/:id: 200 para o que existe e 404 para o que não existe', async () => {
    const existe = await http
      .get('/api/equipamentos/eqp-projetor')
      .set('Authorization', `Bearer ${tokenProfessor}`);
    expect(existe.status).toBe(200);
    expect(existe.body.dados.nome).toBe('Projetor Epson PowerLite');

    const naoExiste = await http
      .get('/api/equipamentos/nao-existe')
      .set('Authorization', `Bearer ${tokenProfessor}`);
    expect(naoExiste.status).toBe(404);
    expect(naoExiste.body.mensagem).toBe('Equipamento não encontrado.');
  });

  it('as respostas saem com os cabeçalhos de segurança (helmet)', async () => {
    const resposta = await http.get('/api/equipamentos');
    expect(resposta.headers['x-powered-by']).toBeUndefined();
    expect(resposta.headers['x-content-type-options']).toBe('nosniff');
  });

  it('rota que não existe: 404 no envelope', async () => {
    const resposta = await http
      .get('/api/nao-existe')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(resposta.status).toBe(404);
    expect(resposta.body.mensagem).toBe('Rota não encontrada.');
  });

  it('o login bloqueia depois de 5 tentativas por minuto (429)', async () => {
    // Este teste fica por último: ele esgota o limite de login deste IP.
    const codigos: number[] = [];
    for (let i = 0; i < 6; i++) {
      codigos.push((await entrar('admin@fab.com', 'errada')).status);
    }
    expect(codigos).toContain(429);
    expect(codigos.at(-1)).toBe(429);
  });
});
