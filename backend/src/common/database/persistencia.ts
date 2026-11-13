import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { ErroDeConfiguracao } from '../erro-de-configuracao.js';

/**
 * ONDE OS DADOS FICAM
 * ======================================================================================
 * - `memoria` (padrão): cada repositório guarda os dados num Map e recarrega o seed a cada
 *   reinício. Não precisa de banco. É o modo dos testes.
 * - `postgres`: os repositórios que já foram levados para o banco usam o PostgreSQL
 *   (DATABASE_URL). Os que ainda não foram continuam em memória, com um aviso no log.
 *
 * Por que ler o .env aqui, e não pelo ConfigService? Porque a escolha do repositório
 * acontece quando o Nest MONTA os módulos (nos decorators @Module), antes de o ConfigModule
 * existir. Esta função lê só a variável PERSISTENCIA, sem alterar o process.env.
 * ======================================================================================
 */
export type ModoPersistencia = 'memoria' | 'postgres';

export const MODOS_PERSISTENCIA: readonly ModoPersistencia[] = [
  'memoria',
  'postgres',
];

/**
 * Lê o modo de persistência. Ordem: variável de ambiente, depois o arquivo .env, depois
 * o padrão `memoria`. Valor desconhecido é erro (melhor parar do que gravar no lugar errado).
 */
export function lerModoPersistencia(
  ambiente: NodeJS.ProcessEnv = process.env,
  arquivoEnv = '.env',
): ModoPersistencia {
  let valor = ambiente.PERSISTENCIA;
  if (valor === undefined && existsSync(arquivoEnv)) {
    valor = parseEnv(readFileSync(arquivoEnv, 'utf8')).PERSISTENCIA;
  }
  const modo = (valor ?? '').trim().toLowerCase() || 'memoria';

  if (!MODOS_PERSISTENCIA.includes(modo as ModoPersistencia)) {
    throw new ErroDeConfiguracao(
      `PERSISTENCIA="${valor}" é inválida. Use "memoria" (sem banco) ou "postgres".`,
    );
  }
  return modo as ModoPersistencia;
}
