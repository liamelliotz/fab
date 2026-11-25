import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configurarApp } from './../src/common/configurar-app.js';
import { EQUIPAMENTO_IDS, USUARIO_IDS } from './../src/common/seed/index.js';
import { UsuariosRepository } from './../src/usuarios/usuarios.repository.js';

/**
 * Card A3: GET /usuarios, GET /usuarios/resumo, GET /usuarios/:id e POST /usuarios.
 * Roda em memória (npm run test:e2e) e no banco (npm run test:e2e:postgres).
 * As contas criadas aqui são apagadas no fim, para o banco ficar igual ao seed.
 */

/** CPF válido a partir de 9 dígitos (calcula os 2 verificadores). */
function gerarCpf(nove: string): string {
  const d = nove.split('').map(Number);
  for (const tamanho of [9, 10]) {
    const soma = d
      .slice(0, tamanho)
      .reduce((total, n, i) => total + n * (tamanho + 1 - i), 0);
    const resto = (soma * 10) % 11;
    d.push(resto === 10 ? 0 : resto);
  }
  return d.join('');
}

// Diferente a cada execução: no banco, rodadas seguidas não colidem.
const sufixo = Date.now().toString().slice(-7);
const novaConta = {
  nome: 'Beatriz Teste A3',
  email: `beatriz.a3.${sufixo}@escola.br`,
  cpf: gerarCpf(`80${sufixo}`),
  senha: 'senha-forte-123',
  telefone: '(96) 99111-0099',
  departamento: 'Mecânica',
  habilitacoes: [EQUIPAMENTO_IDS.impressora3d],
};

describe('Usuários (e2e, card A3)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let tokenAdmin: string;
  let tokenProfessor: string;
  const criados: string[] = [];

  const entrar = (email: string, senha: string) =>
    http.post('/api/auth/login').send({ email, senha });
  const comoAdmin = (rota: string) =>
    http.get(rota).set('Authorization', `Bearer ${tokenAdmin}`);
  const comoProfessor = (rota: string) =>
    http.get(rota).set('Authorization', `Bearer ${tokenProfessor}`);
  const cadastrar = (corpo: object) =>
    http
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo);

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
    http = request(app.getHttpServer());

    tokenAdmin = (await entrar('admin@fab.com', 'admin123')).body.dados
      .tokenAcesso;
    tokenProfessor = (await entrar('professor@fab.com', 'prof123')).body.dados
      .tokenAcesso;
  });

  afterAll(async () => {
    const repositorio = app.get(UsuariosRepository);
    for (const id of criados) await repositorio.remover(id);
    await app.close();
  });

  it('professor: GET /usuarios dá 403 e o resumo vem sem CPF, e-mail ou telefone', async () => {
    const lista = await comoProfessor('/api/usuarios');
    expect(lista.status).toBe(403);

    const resumo = await comoProfessor('/api/usuarios/resumo');
    expect(resumo.status).toBe(200);
    expect(resumo.body.dados.length).toBeGreaterThanOrEqual(6);
    for (const item of resumo.body.dados) {
      expect(Object.keys(item).sort()).toEqual(
        expect.arrayContaining(['habilitacoes', 'id', 'nome']),
      );
      expect(item).not.toHaveProperty('cpf');
      expect(item).not.toHaveProperty('email');
      expect(item).not.toHaveProperty('telefone');
      expect(item).not.toHaveProperty('senhaHash');
    }

    const busca = await comoProfessor('/api/usuarios/resumo?busca=docência');
    expect(busca.body.dados.map((u: { id: string }) => u.id)).toEqual([
      USUARIO_IDS.professor,
    ]);
  });

  it('admin: GET /usuarios filtra, pagina e ordena pelo nome', async () => {
    const pagina = await comoAdmin(
      '/api/usuarios?itensPorPagina=2&perfil=usuario',
    );
    expect(pagina.status).toBe(200);
    expect(pagina.body.dados).toMatchObject({
      paginaAtual: 1,
      itensPorPagina: 2,
      temProxima: true,
    });
    const nomes = pagina.body.dados.itens.map((u: { nome: string }) => u.nome);
    expect(nomes).toEqual(
      [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    );

    const invalido = await comoAdmin('/api/usuarios?perfil=chefe&status=x');
    expect(invalido.status).toBe(400);
    expect(invalido.body.erros).toEqual(
      expect.arrayContaining(['perfil inválido.', 'status inválido.']),
    );
  });

  it('admin: GET /usuarios/:id dá 200 ou 404', async () => {
    const existe = await comoAdmin(`/api/usuarios/${USUARIO_IDS.ana}`);
    expect(existe.status).toBe(200);
    expect(existe.body.dados).toMatchObject({ email: 'ana@escola.br' });

    const naoExiste = await comoAdmin('/api/usuarios/nao-existe');
    expect(naoExiste.status).toBe(404);
    expect(naoExiste.body.mensagem).toBe('Usuário não encontrado.');
  });

  it('CPF inválido dá 400 em português; e-mail ou CPF repetido dá 409', async () => {
    const cpfInvalido = await cadastrar({
      ...novaConta,
      cpf: '529.982.247-24',
    });
    expect(cpfInvalido.status).toBe(400);
    expect(cpfInvalido.body.erros).toContain('CPF inválido.');

    const curta = await cadastrar({ ...novaConta, senha: '1234567' });
    expect(curta.status).toBe(400);
    expect(curta.body.erros).toContain(
      'A senha deve ter no mínimo 8 caracteres.',
    );

    const emailRepetido = await cadastrar({
      ...novaConta,
      email: 'Admin@FAB.com',
    });
    expect(emailRepetido.status).toBe(409);
    expect(emailRepetido.body.mensagem).toBe(
      'Já existe um usuário com este e-mail.',
    );

    const cpfRepetido = await cadastrar({
      ...novaConta,
      cpf: '529.982.247-25', // CPF do admin, com pontuação
    });
    expect(cpfRepetido.status).toBe(409);
    expect(cpfRepetido.body.mensagem).toBe(
      'Já existe um usuário com este CPF.',
    );

    const semTreinamento = await cadastrar({
      ...novaConta,
      habilitacoes: [EQUIPAMENTO_IDS.projetor],
    });
    expect(semTreinamento.status).toBe(400);
  });

  it('POST /usuarios cria a conta, sem senhaHash, e a conta consegue fazer login', async () => {
    const proibido = await http
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${tokenProfessor}`)
      .send(novaConta);
    expect(proibido.status).toBe(403);

    const criado = await cadastrar(novaConta);
    expect(criado.status).toBe(201);
    expect(criado.body.mensagem).toBe('Usuário cadastrado.');
    expect(criado.body.dados).toMatchObject({
      email: novaConta.email,
      cpf: novaConta.cpf,
      telefone: '96991110099',
      perfil: 'usuario',
      status: 'ativo',
      habilitacoes: [EQUIPAMENTO_IDS.impressora3d],
    });
    criados.push(criado.body.dados.id);

    const login = await entrar(novaConta.email, novaConta.senha);
    expect(login.status).toBe(200);
    expect(login.body.dados.usuario.id).toBe(criado.body.dados.id);

    // Nenhuma resposta do módulo traz o hash da senha.
    for (const corpo of [
      criado.body,
      login.body,
      (await comoAdmin('/api/usuarios?itensPorPagina=100')).body,
      (await comoAdmin(`/api/usuarios/${criado.body.dados.id}`)).body,
      (await comoProfessor('/api/usuarios/resumo')).body,
    ]) {
      expect(JSON.stringify(corpo)).not.toMatch(
        /senhaHash|senha_hash|\$2[aby]\$/,
      );
    }
  });
});

describe('Usuários (e2e, card A4): editar, status e habilitações', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let tokenAdmin: string;
  let tokenProfessor: string;
  const criados: string[] = [];

  const sufixoA4 = Date.now().toString().slice(-7);
  const contaA4 = {
    nome: 'Conta Teste A4',
    email: `conta.a4.${sufixoA4}@escola.br`,
    cpf: gerarCpf(`81${sufixoA4}`),
    senha: 'senha-forte-123',
  };

  const entrar = (email: string, senha: string) =>
    http.post('/api/auth/login').send({ email, senha });
  const comToken = (token: string) => ({
    get: (rota: string) =>
      http.get(rota).set('Authorization', `Bearer ${token}`),
    patch: (rota: string, corpo: object) =>
      http.patch(rota).set('Authorization', `Bearer ${token}`).send(corpo),
    put: (rota: string, corpo: object) =>
      http.put(rota).set('Authorization', `Bearer ${token}`).send(corpo),
  });

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
    http = request(app.getHttpServer());
    tokenAdmin = (await entrar('admin@fab.com', 'admin123')).body.dados
      .tokenAcesso;
    tokenProfessor = (await entrar('professor@fab.com', 'prof123')).body.dados
      .tokenAcesso;
  });

  afterAll(async () => {
    const repositorio = app.get(UsuariosRepository);
    for (const id of criados) await repositorio.remover(id);
    await app.close();
  });

  it('PATCH /usuarios/:id edita os campos; professor 403; id inexistente 404; perfil inválido 400', async () => {
    const admin = comToken(tokenAdmin);
    const criado = await http
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(contaA4);
    expect(criado.status).toBe(201);
    criados.push(criado.body.dados.id);
    const id = criado.body.dados.id as string;

    const editado = await admin.patch(`/api/usuarios/${id}`, {
      nome: 'Conta Teste A4 Editada',
      telefone: '(96) 98888-7777',
      departamento: 'Mecânica',
    });
    expect(editado.status).toBe(200);
    expect(editado.body.mensagem).toBe('Usuário atualizado.');
    expect(editado.body.dados).toMatchObject({
      nome: 'Conta Teste A4 Editada',
      telefone: '96988887777',
      departamento: 'Mecânica',
      email: contaA4.email, // e-mail não muda por aqui
    });
    expect(JSON.stringify(editado.body)).not.toMatch(/senhaHash/);

    expect(
      (
        await comToken(tokenProfessor).patch(`/api/usuarios/${id}`, {
          nome: 'X',
        })
      ).status,
    ).toBe(403);
    expect(
      (await admin.patch('/api/usuarios/nao-existe', { nome: 'X' })).status,
    ).toBe(404);
    const invalido = await admin.patch(`/api/usuarios/${id}`, {
      perfil: 'chefe',
    });
    expect(invalido.status).toBe(400);
  });

  it('usuário bloqueado recebe 401 na próxima requisição, mesmo com token ainda válido', async () => {
    const id = criados[0];
    const token = (await entrar(contaA4.email, contaA4.senha)).body.dados
      .tokenAcesso as string;
    const conta = comToken(token);
    expect((await conta.get('/api/auth/me')).status).toBe(200);

    const bloqueio = await comToken(tokenAdmin).patch(
      `/api/usuarios/${id}/status`,
      {
        status: 'bloqueado',
      },
    );
    expect(bloqueio.status).toBe(200);
    expect(bloqueio.body.dados.status).toBe('bloqueado');

    // O mesmo token, sem esperar ele vencer:
    expect((await conta.get('/api/auth/me')).status).toBe(401);
    expect((await conta.get('/api/usuarios/resumo')).status).toBe(401);

    // Reativada, a conta volta a funcionar com o mesmo token.
    await comToken(tokenAdmin).patch(`/api/usuarios/${id}/status`, {
      status: 'ativo',
    });
    expect((await conta.get('/api/auth/me')).status).toBe(200);

    const statusInvalido = await comToken(tokenAdmin).patch(
      `/api/usuarios/${id}/status`,
      {
        status: 'suspenso',
      },
    );
    expect(statusInvalido.status).toBe(400);
  });

  it('travas: o admin não muda o próprio status nem rebaixa o próprio perfil (409)', async () => {
    const admin = comToken(tokenAdmin);
    const proprioStatus = await admin.patch(
      `/api/usuarios/${USUARIO_IDS.admin}/status`,
      {
        status: 'inativo',
      },
    );
    expect(proprioStatus.status).toBe(409);
    expect(proprioStatus.body.mensagem).toBe(
      'Você não pode alterar o status da sua própria conta.',
    );

    const proprioPerfil = await admin.patch(
      `/api/usuarios/${USUARIO_IDS.admin}`,
      {
        perfil: 'usuario',
      },
    );
    expect(proprioPerfil.status).toBe(409);
    expect(proprioPerfil.body.mensagem).toBe(
      'Você não pode rebaixar o seu próprio perfil de administrador.',
    );

    // O admin continua admin e ativo.
    expect((await admin.get('/api/auth/me')).body.dados).toMatchObject({
      perfil: 'admin',
      status: 'ativo',
    });
    // A trava "sempre um admin ativo" é testada no usuarios.service.spec.ts: pela API ela
    // nunca dispara sozinha, porque quem chama é um admin ativo que não pode mexer em si mesmo.
  });

  it('PUT /usuarios/:id/habilitacoes substitui a lista; sem treinamento ou inexistente dá 400', async () => {
    const admin = comToken(tokenAdmin);
    const id = criados[0];
    const trocou = await admin.put(`/api/usuarios/${id}/habilitacoes`, {
      equipamentoIds: [
        EQUIPAMENTO_IDS.impressora3d,
        EQUIPAMENTO_IDS.osciloscopio,
      ],
    });
    expect(trocou.status).toBe(200);
    expect(trocou.body.mensagem).toBe('Habilitações atualizadas.');
    expect(trocou.body.dados.habilitacoes).toEqual(
      expect.arrayContaining([
        EQUIPAMENTO_IDS.impressora3d,
        EQUIPAMENTO_IDS.osciloscopio,
      ]),
    );

    const substituiu = await admin.put(`/api/usuarios/${id}/habilitacoes`, {
      equipamentoIds: [EQUIPAMENTO_IDS.osciloscopio],
    });
    expect(substituiu.body.dados.habilitacoes).toEqual([
      EQUIPAMENTO_IDS.osciloscopio,
    ]);

    const semTreinamento = await admin.put(`/api/usuarios/${id}/habilitacoes`, {
      equipamentoIds: [EQUIPAMENTO_IDS.projetor],
    });
    expect(semTreinamento.status).toBe(400);
    expect(semTreinamento.body.mensagem).toMatch(/não exige treinamento/);

    const inexistente = await admin.put(`/api/usuarios/${id}/habilitacoes`, {
      equipamentoIds: ['eqp-fantasma'],
    });
    expect(inexistente.status).toBe(400);
    expect(inexistente.body.mensagem).toBe(
      'O equipamento "eqp-fantasma" não existe.',
    );

    const formato = await admin.put(`/api/usuarios/${id}/habilitacoes`, {
      equipamentoIds: 'x',
    });
    expect(formato.status).toBe(400);
    expect(
      (
        await admin.put('/api/usuarios/nao-existe/habilitacoes', {
          equipamentoIds: [],
        })
      ).status,
    ).toBe(404);

    // As tentativas que falharam não mudaram nada.
    expect(
      (await admin.get(`/api/usuarios/${id}`)).body.dados.habilitacoes,
    ).toEqual([EQUIPAMENTO_IDS.osciloscopio]);
  });
});
