import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * npm run test:e2e          → API em memória (não precisa de banco)
 * npm run test:e2e:postgres → API no PostgreSQL (E5_DATABASE_URL; o script executa o reset)
 * O modo vem do --mode, e não do .env, para o teste nunca depender da máquina de quem roda.
 */
export default defineConfig(({ mode }) => ({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    pool: 'forks',
    fileParallelism: false,
    hookTimeout: 120_000,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: { PERSISTENCIA: mode === 'postgres' ? 'postgres' : 'memoria' },
  },
}));
