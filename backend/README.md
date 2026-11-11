# FAB — Backend

API do FAB (empréstimos de equipamentos e gestão de insumos), feita com **NestJS 12**.
Contrato da API: [`docs/contrato-api.md`](../docs/contrato-api.md). Banco: [`docs/banco.md`](../docs/banco.md).

## Requisitos

- Node.js 24 LTS (traz o npm 11)
- Docker Desktop (para o PostgreSQL) ou um PostgreSQL 13+ instalado

## Instalar e rodar

```bash
cd backend
npm ci                       # instala exatamente o que está no package-lock.json
cp .env.example .env         # Windows (PowerShell): Copy-Item .env.example .env
npm run start:dev
```

- API: <http://localhost:3000/api>
- Swagger (documentação e teste das rotas): <http://localhost:3000/api/docs>

Para testar no Swagger: chame `POST /auth/login`, copie o `tokenAcesso`, clique em **Authorize** e cole.

| Conta | E-mail | Senha |
| --- | --- | --- |
| Administrador | `admin@fab.com` | `admin123` |
| Professor | `professor@fab.com` | `prof123` |

> Hoje a API guarda os dados **em memória** (recriados a cada reinício, a partir do seed), então ela roda
> mesmo sem o banco. As tabelas do PostgreSQL já estão prontas; cada módulo passa a usá-las no seu card.

## Banco de dados

```bash
docker compose up -d         # na RAIZ do projeto: PostgreSQL 16 na porta 5432
cd backend
npm run db:migrate           # cria as tabelas (database/migrations/*.sql)
npm run db:seed              # APAGA os dados e grava os de exemplo
```

`npm run db:reset` faz migrate e seed de uma vez. Sem Docker, aponte o `DATABASE_URL` do `.env` para o seu PostgreSQL.

## Variáveis do `.env`

| Variável | Para quê | Padrão |
| --- | --- | --- |
| `NODE_ENV` | `production` exige `JWT_SECRET` forte e desliga o Swagger | `development` |
| `PORT` | porta da API | `3000` |
| `JWT_SECRET` | assina os tokens. Mínimo de 32 caracteres aleatórios | — |
| `JWT_EXPIRES_IN` | validade do token | `8h` |
| `CORS_ORIGINS` | endereços do front, separados por vírgula (nunca `*`) | `http://localhost:4200` |
| `APP_TIMEZONE` | fuso da escola: define o "hoje" de prazos e atrasos | `America/Belem` |
| `DATABASE_URL` | conexão do PostgreSQL | a do `docker-compose.yml` |
| `SWAGGER_ATIVO` | `true` liga o Swagger em produção | desligado |

O `.env` **nunca** vai para o Git. Gere um segredo com:
`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run start:dev` | sobe a API e reinicia ao salvar |
| `npm run build` | compila para `dist/` |
| `npm run start:prod` | roda a versão compilada |
| `npm run lint` | verifica o código (oxlint) |
| `npm run format` | formata com o Prettier |
| `npm test` | testes unitários (Vitest) |
| `npm run test:e2e` | testes de ponta a ponta (Vitest + Supertest) |
| `npm run db:migrate` / `db:seed` / `db:reset` | banco de dados |

**Antes de abrir um Pull Request, rode os quatro:** `npm run format`, `npm run lint`, `npm test` e `npm run test:e2e`.

## Estrutura

```
backend/
  database/migrations/   arquivos .sql que criam e alteram as tabelas
  src/
    main.ts              CORS, Swagger e porta
    app.module.ts        registro de TODOS os módulos (não edite)
    common/              envelope, erros, paginação, enums, repositório base, seeds, utilitários
    database/            scripts db:migrate e db:seed
    auth/  usuarios/  equipamentos/  emprestimos/
    manutencoes/  insumos/  dashboard/  relatorios/
  test/                  testes e2e (um arquivo por módulo)
```

## O que já funciona

| Rota | Situação |
| --- | --- |
| `POST /auth/login`, `GET /auth/me` | prontas e testadas |
| `GET /equipamentos`, `GET /equipamentos/:id` | prontas e testadas (filtros e paginação) |
| demais rotas do contrato | esqueleto: cada uma tem um card no Trello |

## Regras do projeto (importante)

- **ESM**: todo `import` de arquivo local termina em `.js` (`import { X } from './x.service.js';`).
- **Injeção**: use `@Inject(Classe)` em todo parâmetro de construtor, como nos arquivos prontos.
- **Cada pessoa edita só as pastas do seu card.** `main.ts`, `app.module.ts`, `common/` e `database/` são da Pessoa A.
- **Datas**: "hoje" é `hojeIso()` (`common/utils/data.util.ts`), que respeita o fuso da escola.
- **`atrasado` nunca é gravado**: use `statusParaResposta()` ao montar a resposta.
- Controllers devolvem só o dado; o envelope `{ sucesso, mensagem, dados, erros, timestamp }` é automático.
- Erros de regra usam as exceções do Nest com mensagem em português: `NotFoundException` (404),
  `ConflictException` (409), `ForbiddenException` (403), `BadRequestException` (400).
- Todo card de backend entrega testes: `*.spec.ts` ao lado do service e, para rotas, `test/<modulo>.e2e-spec.ts`.
- Nos e2e, faça login **uma vez** no `beforeAll` e reaproveite o token (o login aceita 5 tentativas por minuto).

## Ferramentas

O Nest 12 gerou o projeto com **Vitest** (no lugar do Jest), **oxlint** (no lugar do ESLint) e **ESM**.
O Vitest já injeta `describe`, `it` e `expect`. Supertest: `import request from 'supertest';`.
