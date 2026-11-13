/**
 * npm run db:migrate
 * Aplica, em ordem, os arquivos .sql de backend/database/migrations que ainda não foram
 * aplicados. Cada arquivo roda em uma transação e fica registrado em `migracoes_aplicadas`,
 * então rodar de novo não repete nada.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { conectar, emTransacao } from './conexao.js';

const PASTA = join(process.cwd(), 'database', 'migrations');

async function migrar(): Promise<void> {
  const arquivos = readdirSync(PASTA)
    .filter((nome) => nome.endsWith('.sql'))
    .sort();
  const cliente = await conectar();
  try {
    await cliente.query(`
      CREATE TABLE IF NOT EXISTS migracoes_aplicadas (
        nome        TEXT PRIMARY KEY,
        aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    const { rows } = await cliente.query<{ nome: string }>(
      'SELECT nome FROM migracoes_aplicadas',
    );
    const aplicadas = new Set(rows.map((linha) => linha.nome));

    let novas = 0;
    for (const nome of arquivos) {
      if (aplicadas.has(nome)) continue;
      const sql = readFileSync(join(PASTA, nome), 'utf8');
      await emTransacao(cliente, async () => {
        await cliente.query(sql);
        await cliente.query(
          'INSERT INTO migracoes_aplicadas (nome) VALUES ($1)',
          [nome],
        );
      });
      console.log(`aplicada: ${nome}`);
      novas++;
    }
    console.log(
      novas === 0
        ? 'Banco já está atualizado.'
        : `${novas} migration(s) aplicada(s).`,
    );
  } finally {
    await cliente.end();
  }
}

migrar().catch((erro: Error) => {
  console.error(`Falha na migration. ${erro.message}`);
  process.exitCode = 1;
});
