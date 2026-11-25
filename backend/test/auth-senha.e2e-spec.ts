import { Logger, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import {
  MENSAGEM_RECUPERACAO,
  VALIDADE_DO_LINK_MS,
  hashDoToken,
} from './../src/auth/senha/redefinicao-senha.service.js';
import { TokensRedefinicaoRepository } from './../src/auth/senha/tokens-redefinicao.repository.js';
import { configurarApp } from './../src/common/configurar-app.js';
import { lerModoPersistencia } from './../src/common/database/index.js';
import { UsuariosRepository } from './../src/usuarios/usuarios.repository.js';

/**
 * Card A5: "esqueci minha senha" (POST /auth/recuperar-senha e /auth/redefinir-senha).
 * Roda em memória (npm run test:e2e) e no banco (npm run test:e2e:postgres).
 * O fluxo usa uma conta criada aqui (apagada no fim), para não mexer na senha do seed.
 *
 * ATENÇÃO: a recuperação aceita 3 pedidos por minuto por IP. Os testes usam exatamente 3
 * e o teste do 429 fica por último. O token vencido é gravado direto no repositório.
 */
const comBanco = lerModoPersistencia() === 'postgres';

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

const sufixo = Date.now().toString().slice(-7);
const conta = {
  nome: 'Teste Senha A5',
  email: `senha.a5.${sufixo}@escola.br`,
  cpf: gerarCpf(`70${sufixo}`),
  senha: 'senha-antiga-123',
};

describe('Recuperar e redefinir senha (e2e, card A5)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let usuarioId: string;
  let token: string;
  let logs: string[];

  const entrar = (email: string, senha: string) =>
    http.post('/api/auth/login').send({ email, senha });
  const recuperar = (email: string) =>
    http.post('/api/auth/recuperar-senha').send({ email });
  const redefinir = (tokenDoLink: string, novaSenha: string) =>
    http
      .post('/api/auth/redefinir-senha')
      .send({ token: tokenDoLink, novaSenha });

  beforeAll(async () => {
    logs = [];
    vi.spyOn(Logger.prototype, 'log').mockImplementation((m: unknown) => {
      logs.push(String(m));
    });
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
    http = request(app.getHttpServer());

    const tokenAdmin = (await entrar('admin@fab.com', 'admin123')).body.dados
      .tokenAcesso;
    const criada = await http
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(conta);
    expect(criada.status).toBe(201);
    usuarioId = criada.body.dados.id;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    if (usuarioId) await app.get(UsuariosRepository).remover(usuarioId);
    await app?.close();
  });

  it('a resposta é idêntica para e-mail que existe e que não existe', async () => {
    const existe = await recuperar(conta.email);
    const linkNoLog = logs.find((l) => l.includes(conta.email));
    const naoExiste = await recuperar(`ninguem.${sufixo}@escola.br`);

    expect(existe.status).toBe(200);
    expect(naoExiste.status).toBe(existe.status);
    // Tudo igual, menos o horário da resposta.
    const semHorario = ({ timestamp: _t, ...resto }: Record<string, unknown>) =>
      resto;
    expect(semHorario(naoExiste.body)).toEqual(semHorario(existe.body));
    expect(semHorario(existe.body)).toEqual({
      sucesso: true,
      mensagem: MENSAGEM_RECUPERACAO,
      dados: null,
      erros: [],
    });

    // Fora de produção, o link vai para o log da API (não há e-mail nesta versão).
    expect(linkNoLog).toMatch(/\/redefinir-senha\?token=[\w-]{43}/);
    token = linkNoLog!.match(/token=([\w-]+)/)![1];
  });

  it('o banco não guarda o token em texto, só o hash SHA-256', async () => {
    const salvos = (await app.get(TokensRedefinicaoRepository).listar()).filter(
      (t) => t.usuarioId === usuarioId,
    );
    expect(salvos).toHaveLength(1);
    expect(salvos[0].tokenHash).toBe(hashDoToken(token));
    expect(salvos[0].tokenHash).not.toBe(token);

    if (comBanco) {
      const linhas: Record<string, unknown>[] = await app
        .get(DataSource)
        .query('SELECT * FROM tokens_redefinicao_senha WHERE usuario_id = $1', [
          usuarioId,
        ]);
      expect(linhas).toHaveLength(1);
      expect(JSON.stringify(linhas)).not.toContain(token);
      expect(linhas[0].token_hash).toBe(hashDoToken(token));
    }
  });

  it('o token funciona uma única vez e a senha antiga para de funcionar', async () => {
    const primeira = await redefinir(token, 'senha-nova-456');
    expect(primeira.status).toBe(200);

    expect((await entrar(conta.email, conta.senha)).status).toBe(401);
    expect((await entrar(conta.email, 'senha-nova-456')).status).toBe(200);

    const segunda = await redefinir(token, 'outra-senha-789');
    expect(segunda.status).toBe(400);
    expect(segunda.body.mensagem).toBe('Este link já foi usado. Peça um novo.');
    expect((await entrar(conta.email, 'outra-senha-789')).status).toBe(401);
  });

  it('token vencido: 400 e a senha não muda', async () => {
    const vencido = `vencido-${sufixo}-token-de-teste`;
    const agora = Date.now();
    await app.get(TokensRedefinicaoRepository).criar({
      usuarioId,
      tokenHash: hashDoToken(vencido),
      criadoEm: new Date(agora - VALIDADE_DO_LINK_MS - 60_000).toISOString(),
      expiraEm: new Date(agora - 60_000).toISOString(),
    });

    const resposta = await redefinir(vencido, 'senha-tardia-000');
    expect(resposta.status).toBe(400);
    expect(resposta.body.mensagem).toBe('Este link expirou. Peça um novo.');
  });

  it('token inventado e senha curta: 400', async () => {
    expect((await redefinir('nao-existe', 'senha-valida-1')).status).toBe(400);
    const curta = await redefinir(token, '123');
    expect(curta.status).toBe(400);
    expect(JSON.stringify(curta.body)).toContain('no mínimo 8 caracteres');
  });

  it('a recuperação bloqueia depois de 3 pedidos por minuto (429)', async () => {
    // Fica por último: esgota o limite deste IP (já foram 2 pedidos acima).
    const codigos: number[] = [];
    for (let i = 0; i < 2; i++) {
      codigos.push((await recuperar(`limite.${i}@escola.br`)).status);
    }
    expect(codigos).toEqual([200, 429]);
  });
});
