import { existsSync } from 'node:fs';
import pg from 'pg';
import { mensagemDeFalhaDeConexao } from '../common/database/erro-de-conexao.js';

/**
 * Conexão usada pelos scripts de banco (db:migrate e db:seed).
 * Lê DATABASE_URL do ambiente ou do arquivo .env da pasta backend/.
 */
export function lerUrlDoBanco(): string {
  if (!process.env.DATABASE_URL && existsSync('.env')) {
    process.loadEnvFile('.env');
  }
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      'DATABASE_URL não está definida. Copie .env.example para .env (rode os comandos dentro de backend/).',
    );
  }
  return url;
}

export async function conectar(): Promise<pg.Client> {
  const cliente = new pg.Client({
    connectionString: lerUrlDoBanco(),
    connectionTimeoutMillis: 5_000,
  });
  try {
    await cliente.connect();
  } catch (erro) {
    throw new Error(mensagemDeFalhaDeConexao(erro), { cause: erro });
  }
  return cliente;
}

/** Roda `acao` dentro de uma transação: ou tudo é gravado, ou nada. */
export async function emTransacao<T>(
  cliente: pg.Client,
  acao: () => Promise<T>,
): Promise<T> {
  await cliente.query('BEGIN');
  try {
    const resultado = await acao();
    await cliente.query('COMMIT');
    return resultado;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  }
}
