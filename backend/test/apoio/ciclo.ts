import { randomInt, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import pg from 'pg';
import request from 'supertest';
import { configurarApp } from '../../src/common/configurar-app.js';

export function cpfValido(): string {
  const d = String(randomInt(100_000_000, 999_999_999)).split('').map(Number);
  for (const n of [9, 10]) {
    const r = (d.reduce((s, x, i) => s + x * (n + 1 - i), 0) * 10) % 11;
    d.push(r === 10 ? 0 : r);
  }
  return d.join('');
}
export function hoje(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.APP_TIMEZONE ?? 'America/Belem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export async function dados<T>(req: request.Test, status = 200): Promise<T> {
  const r = await req;
  expect(
    r.status,
    `${req.method} ${req.url}: HTTP ${r.status}; ${JSON.stringify(r.body)}`,
  ).toBe(status);
  expect(r.body.sucesso).toBe(true);
  return r.body.dados as T;
}

/** Cada cenário tem app novo; no PostgreSQL também recebe schema e seed próprios. */
export async function abrirCiclo() {
  let app: INestApplication | undefined;
  let controle: pg.Client | undefined;
  const schema = `e5_${randomUUID().replaceAll('-', '')}`;
  const anterior = {
    DATABASE_URL: process.env.DATABASE_URL,
    PGOPTIONS: process.env.PGOPTIONS,
  };
  const comBanco = process.env.PERSISTENCIA === 'postgres';
  async function fechar() {
    try {
      await app?.close();
    } finally {
      try {
        if (controle)
          await controle.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      } finally {
        await controle?.end();
        for (const [k, v] of Object.entries(anterior)) {
          if (v === undefined) delete process.env[k];
          else process.env[k] = v;
        }
      }
    }
  }
  try {
    if (comBanco) {
      const url = new URL(process.env.E5_DATABASE_URL ?? '');
      if (!/^\/[a-zA-Z0-9_]+_test$/.test(url.pathname))
        throw new Error(
          'O ciclo PostgreSQL exige E5_DATABASE_URL em banco *_test.',
        );
      controle = new pg.Client({ connectionString: url.toString() });
      await controle.connect();
      await controle.query(`CREATE SCHEMA "${schema}"`);
      url.searchParams.set('options', `-c search_path=${schema}`);
      process.env.DATABASE_URL = url.toString();
      process.env.PGOPTIONS = `-c search_path=${schema}`;
      // As migrations e o seed são os do projeto, dentro do schema exclusivo deste cenário.
      for (const script of ['migrar', 'semear'])
        execFileSync(process.execPath, [`dist/database/${script}.js`], {
          env: { ...process.env, NODE_ENV: 'test' },
          stdio: 'pipe',
          timeout: 60_000,
        });
    }
    const { AppModule } = await import('../../src/app.module.js');
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
    if (comBanco) {
      const linhas: { schema: string }[] = await app
        .get(DataSource)
        .query('SELECT current_schema() AS schema');
      expect(
        linhas[0].schema,
        'A conexão da API deve usar o schema exclusivo do cenário',
      ).toBe(schema);
    }
    const http = request(app.getHttpServer());
    const login = async (email: string, senha: string) =>
      (
        await dados<{ tokenAcesso: string }>(
          http.post('/api/auth/login').send({ email, senha }),
        )
      ).tokenAcesso;
    const admin = await login('admin@fab.com', 'admin123');
    async function persistido(
      tabela:
        | 'usuarios'
        | 'equipamentos'
        | 'emprestimos'
        | 'insumos'
        | 'movimentacoes_insumo'
        | 'manutencoes',
      id: string,
      esperado: Record<string, unknown> = {},
    ) {
      if (!comBanco) return;
      const linhas: Record<string, unknown>[] = await app!
        .get(DataSource)
        .query(`SELECT * FROM "${tabela}" WHERE id = $1`, [id]);
      expect(
        linhas,
        `${tabela}/${id} precisa existir no PostgreSQL; não basta fallback em memória`,
      ).toHaveLength(1);
      expect(linhas[0]['id']).toBe(id);
      for (const [campo, valor] of Object.entries(esperado)) {
        // O driver pg devolve NUMERIC como string.
        const atual = linhas[0][campo];
        expect(
          typeof valor === 'number' ? Number(atual) : atual,
          `${tabela}.${campo} precisa refletir a operação no PostgreSQL`,
        ).toEqual(valor);
      }
    }
    return {
      app,
      http,
      admin,
      login,
      persistido,
      fechar,
      sufixo: randomUUID().replaceAll('-', ''),
    };
  } catch (erro) {
    await fechar();
    throw erro;
  }
}
