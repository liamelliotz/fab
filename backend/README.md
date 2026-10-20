# FAB — Backend

API do FAB (gestão de empréstimos de equipamentos), feita com **NestJS**.
Este README é provisório: a documentação completa entra no Card 33.

## Requisitos

- Node.js 24 LTS (ou superior)
- npm

## Como rodar

```bash
cd backend
npm install
cp .env.example .env        # no Windows (PowerShell): Copy-Item .env.example .env
npm run start:dev
```

- API: <http://localhost:3000/api>
- Swagger (documentação e testes das rotas): <http://localhost:3000/api/docs>

O arquivo `.env` **nunca** vai para o Git. Troque o `JWT_SECRET` por um valor seu.

## Scripts

| Comando              | O que faz                                    |
| -------------------- | -------------------------------------------- |
| `npm run start:dev`  | Sobe a API e reinicia ao salvar um arquivo   |
| `npm run build`      | Compila para `dist/`                         |
| `npm run start:prod` | Roda a versão compilada                      |
| `npm run lint`       | Verifica o código (oxlint)                   |
| `npm test`           | Testes unitários (Vitest)                    |
| `npm run test:e2e`   | Testes de ponta a ponta (Vitest + Supertest) |

## Estrutura

```
src/
  main.ts            prefixo /api, CORS, validação global e Swagger
  app.module.ts      configuração global e registro de todos os módulos
  auth/  usuarios/  equipamentos/  emprestimos/
  manutencoes/  dashboard/  relatorios/
```

Cada pasta tem seu módulo, controller e service. **Quem for mexer em uma pasta edita só ela**:
o `main.ts` e o `app.module.ts` já estão prontos para não gerar conflito de merge.

## Ferramentas (diferem do plano original)

O Nest 12 gerou o projeto com ferramentas diferentes das citadas no plano:

| Plano           | Projeto real                                             |
| --------------- | -------------------------------------------------------- |
| Jest            | **Vitest** (`vitest.config.ts` e `vitest.config.e2e.ts`) |
| ESLint          | **oxlint** (`npm run lint`)                              |
| `jest-e2e.json` | `vitest.config.e2e.ts`                                   |
| CommonJS        | **ESM** (`"type": "module"`)                             |

- Testes unitários: arquivos `*.spec.ts` em `src/`. Testes de ponta a ponta: `*.e2e-spec.ts` em `test/`.
- O Vitest já injeta `describe`, `it` e `expect` (não precisa importar).
- Supertest: `import request from 'supertest';`

## Regras do projeto (importante)

- O projeto usa **ESM**: todo `import` de arquivo local termina em `.js`
  (por exemplo, `import { AuthService } from './auth.service.js';`). O `nest g` já faz isso sozinho.
- Para criar uma nova peça, use o gerador sem teste: `npx nest g service nome --no-spec`.
  Só a pessoa responsável pela qualidade cria arquivos `*.spec.ts`.
- Toda resposta segue o envelope `{ sucesso, mensagem, dados, erros, timestamp }` (entra no Card 2).

## CORS

Por padrão só `http://localhost:4200` (o `ng serve`) pode chamar a API pelo navegador.
Para liberar outra origem, por exemplo o build com SSR do front em `http://localhost:4000`,
liste-as no `.env`, separadas por vírgula (nunca use `*`):

```
CORS_ORIGINS=http://localhost:4200,http://localhost:4000
```
