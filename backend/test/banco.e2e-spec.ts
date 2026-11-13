import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { lerModoPersistencia } from './../src/common/database/index.js';

/**
 * Teste com o PostgreSQL DE VERDADE. Só roda em `npm run test:e2e:postgres`
 * (antes: banco no ar e `npm run db:reset`). No `npm run test:e2e` normal ele é pulado.
 */
const comBanco = lerModoPersistencia() === 'postgres';

describe.skipIf(!comBanco)('Banco (PERSISTENCIA=postgres)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Importa só depois de saber o modo: o AppModule decide os repositórios ao ser carregado.
    const { AppModule } = await import('./../src/app.module.js');
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('a API sobe conectada ao PostgreSQL', async () => {
    const banco = app.get(DataSource);
    expect(banco.isInitialized).toBe(true);
    const [{ resultado }] = await banco.query('SELECT 1 + 1 AS resultado');
    expect(Number(resultado)).toBe(2);
  });

  it('as tabelas das migrations existem (rode npm run db:migrate se falhar)', async () => {
    const banco = app.get(DataSource);
    const linhas: { nome: string }[] = await banco.query(
      "SELECT table_name AS nome FROM information_schema.tables WHERE table_schema = 'public'",
    );
    const tabelas = linhas.map((l) => l.nome);
    expect(tabelas).toEqual(
      expect.arrayContaining([
        'usuarios',
        'equipamentos',
        'emprestimos',
        'insumos',
      ]),
    );
  });
});
