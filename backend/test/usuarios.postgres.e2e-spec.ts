import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  erroDoBancoParaHttp,
  lerModoPersistencia,
} from './../src/common/database/index.js';
import { EQUIPAMENTO_IDS, USUARIO_IDS } from './../src/common/seed/index.js';
import { UsuariosRepository } from './../src/usuarios/usuarios.repository.js';
import { UsuariosService } from './../src/usuarios/usuarios.service.js';

/**
 * Card A2: usuários gravados no PostgreSQL. Só roda em `npm run test:e2e:postgres`
 * (antes: banco no ar e `npm run db:reset`). Um teste por item do checklist do card.
 * Os usuários criados aqui são apagados no fim de cada teste.
 */
const comBanco = lerModoPersistencia() === 'postgres';

// Dados únicos a cada execução, para nunca colidir com o seed nem com outra rodada.
const sufixo = Date.now().toString().slice(-8);
const novoUsuario = (n: number) => ({
  nome: `Teste A2 ${n}`,
  email: `teste.a2.${sufixo}.${n}@fab.com`,
  cpf: `9${sufixo}${n}`.padEnd(11, '0').slice(0, 11),
  senha: 'senha-de-teste',
});

async function subirApi(): Promise<INestApplication> {
  const { AppModule } = await import('./../src/app.module.js');
  const { configurarApp } = await import('./../src/common/configurar-app.js');
  const modulo = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = modulo.createNestApplication();
  configurarApp(app);
  await app.init();
  return app;
}

describe.skipIf(!comBanco)('Usuários no PostgreSQL (card A2)', () => {
  let app: INestApplication;
  const criados: string[] = [];

  beforeAll(async () => {
    app = await subirApi();
  });

  afterAll(async () => {
    const repositorio = app.get(UsuariosRepository);
    for (const id of criados) await repositorio.remover(id);
    await app?.close();
  });

  it('login de admin@fab.com e GET /auth/me com as habilitações', async () => {
    const http = request(app.getHttpServer());
    const entrar = async (email: string, senha: string) => {
      const resposta = await http
        .post('/api/auth/login')
        .send({ email, senha });
      expect(resposta.status).toBe(200);
      return resposta.body.dados.tokenAcesso as string;
    };

    // Um passo de cada vez: primeiro o token, depois a rota (o supertest fecha o servidor
    // ao fim de cada requisição, então não dá para abrir duas ao mesmo tempo).
    const tokenAdmin = await entrar('admin@fab.com', 'admin123');
    const admin = await http
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(admin.status).toBe(200);
    expect(admin.body.dados).toMatchObject({
      id: USUARIO_IDS.admin,
      perfil: 'admin',
      habilitacoes: [],
    });
    expect(JSON.stringify(admin.body)).not.toMatch(/senha/i);

    // Usuária do seed com duas habilitações (vêm da tabela usuario_habilitacoes).
    const tokenAna = await entrar('ana@escola.br', 'prof123');
    const ana = await http
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenAna}`);
    expect(ana.status).toBe(200);
    expect(ana.body.dados.habilitacoes).toEqual(
      expect.arrayContaining([
        EQUIPAMENTO_IDS.impressora3d,
        EQUIPAMENTO_IDS.osciloscopio,
      ]),
    );
  });

  it('reiniciar a API não apaga nenhum dado', async () => {
    const dados = novoUsuario(1);
    const criado = await app.get(UsuariosService).criar({
      ...dados,
      habilitacoes: [EQUIPAMENTO_IDS.impressora3d],
    });
    criados.push(criado.id);

    await app.close();
    app = await subirApi(); // "reinicia" a API

    const depois = await app.get(UsuariosService).buscarPorEmail(dados.email);
    expect(depois).toMatchObject({
      id: criado.id,
      nome: dados.nome,
      habilitacoes: [EQUIPAMENTO_IDS.impressora3d],
    });
    expect(
      await app
        .get(UsuariosService)
        .validarCredenciais(dados.email, dados.senha),
    ).not.toBeNull();
  });

  it('atualizar troca as habilitações e mantém o resto', async () => {
    const service = app.get(UsuariosService);
    const criado = await service.criar({
      ...novoUsuario(2),
      habilitacoes: [EQUIPAMENTO_IDS.impressora3d],
    });
    criados.push(criado.id);

    const atualizado = await service.atualizar(criado.id, {
      departamento: 'Mecânica',
      habilitacoes: [EQUIPAMENTO_IDS.osciloscopio],
    });
    expect(atualizado).toMatchObject({
      nome: criado.nome,
      departamento: 'Mecânica',
      habilitacoes: [EQUIPAMENTO_IDS.osciloscopio],
    });
    expect(atualizado.atualizadoEm).toBeDefined();
  });

  it('e-mail ou CPF repetido devolve 409, e não erro 500 do banco', async () => {
    const service = app.get(UsuariosService);
    const admin = (await service.buscarPorId(USUARIO_IDS.admin))!;

    await expect(
      service.criar({ ...novoUsuario(3), email: admin.email.toUpperCase() }),
    ).rejects.toMatchObject({
      status: 409,
      message: 'Já existe um usuário com este e-mail.',
    });
    await expect(
      service.criar({ ...novoUsuario(3), cpf: admin.cpf }),
    ).rejects.toMatchObject({
      status: 409,
      message: 'Já existe um usuário com este CPF.',
    });

    // Dois cadastros iguais AO MESMO TEMPO: os dois passam pela checagem do service e
    // quem barra é o índice único do banco. Mesmo assim a resposta é 409.
    const dados = novoUsuario(4);
    const resultados = await Promise.allSettled([
      service.criar(dados),
      service.criar(dados),
    ]);
    const ok = resultados.filter((r) => r.status === 'fulfilled');
    const falhas = resultados.filter((r) => r.status === 'rejected');
    for (const r of ok) criados.push(r.value.id);
    expect(ok).toHaveLength(1);
    expect(falhas).toHaveLength(1);

    const erro = falhas[0].reason as { status?: number };
    const status = erro.status ?? erroDoBancoParaHttp(erro)?.getStatus();
    expect(status).toBe(409);
  });

  it('usuário com empréstimos não é apagado: o banco barra e vira 409', async () => {
    const erro = await app
      .get(UsuariosRepository)
      .remover(USUARIO_IDS.professor)
      .catch((e: unknown) => e);
    expect(erroDoBancoParaHttp(erro)?.getStatus()).toBe(409);
    expect(
      await app.get(UsuariosService).buscarPorId(USUARIO_IDS.professor),
    ).not.toBeNull();
  });
});
