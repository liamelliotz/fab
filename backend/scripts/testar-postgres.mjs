import { spawnSync } from 'node:child_process';

// Reset é destrutivo: aceita somente uma URL explicitamente fornecida de banco *_test.
const valor = process.env.E5_DATABASE_URL;
let url;
try {
  url = new URL(valor ?? '');
} catch {
  throw new Error(
    'Defina E5_DATABASE_URL com um PostgreSQL exclusivo para testes (banco terminado em _test).',
  );
}
if (
  !['postgres:', 'postgresql:'].includes(url.protocol) ||
  !/^\/[a-zA-Z0-9_]+_test$/.test(url.pathname)
) {
  throw new Error(
    'Reset recusado: E5_DATABASE_URL deve apontar para um banco exclusivo terminado em _test.',
  );
}
const ambiente = {
  ...process.env,
  DATABASE_URL: valor,
  PERSISTENCIA: 'postgres',
  NODE_ENV: 'test',
};
// Executa entradas JS diretamente: funciona no Windows sem shell e sem npm.ps1.
function executar(arquivo, args = []) {
  const r = spawnSync(process.execPath, [arquivo, ...args], {
    env: ambiente,
    stdio: 'inherit',
  });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status ?? 1);
}
executar('node_modules/@nestjs/cli/bin/nest.js', ['build']);
executar('dist/database/migrar.js');
executar('dist/database/semear.js');
executar('node_modules/vitest/vitest.mjs', [
  'run',
  '--config',
  './vitest.config.e2e.ts',
  '--mode',
  'postgres',
  ...process.argv.slice(2),
]);
