# FAB — O que mudou na v2 (11/11/2026)

Resumo, arquivo por arquivo, da correção da base do backend. O front não foi alterado.
Verificado em instalação limpa: lint sem avisos, build, 49 testes unitários, 12 testes e2e,
migration e seed aplicados em um PostgreSQL 16.

## Decisões

| Tema | Decisão |
| --- | --- |
| Insumos | Entidade própria (`insumos` e `movimentacoes_insumo`). `consumivel` saiu das categorias de equipamento e o Filamento PLA virou insumo |
| Saída de insumo | Só o admin registra, no balcão, podendo indicar o professor que recebeu |
| Banco | PostgreSQL 16 via Docker Compose, migrations em SQL, TypeORM como mapeador (sem `synchronize`) |
| Contrato | Vale o da demonstração do front: QR, balcão, linha do tempo, habilitações, prazo máximo, cadastro só pelo admin. Transferência entra na 2ª semana |
| Fornecedor e validade | Fornecedor é texto no insumo. Validade é por lote de entrada; o insumo mostra a mais próxima |
| Perfil `responsavel_lab` | Continua fora |
| `atrasado` | Nunca é gravado: é calculado na leitura |

## Problemas do diagnóstico

| # | Situação |
| --- | --- |
| C1 login inexistente | Resolvido: `POST /auth/login` e `GET /auth/me` |
| C2 front não chama a API | Vira os cards de front de cada pessoa (depende das rotas) |
| C3 três contratos | Resolvido: `docs/contrato-api.md` v2 é o único |
| C4 campos da demo faltando | Resolvido nas entidades, nos seeds e no banco |
| M1 `JWT_SECRET` de exemplo | Resolvido: `.env` novo e produção recusa segredo fraco |
| M2 helmet | Resolvido |
| M3 lista sem paginação | Resolvido |
| M4 módulo não exportava o service | Resolvido |
| M5 e M6 seeds diferentes e estoque incoerente | Resolvido, com teste que confere |
| M7 `atrasado` com duas fontes | Resolvido |
| M8 protocolo repetido | Resolvido na memória e no banco |
| M9 fuso do servidor | Resolvido: `APP_TIMEZONE` |
| M10 sem testes | Resolvido para o que existe; cada card novo entrega os seus |
| M11 e M12 senhas no navegador e telas com dados fixos | Cards de front |
| M13 `consumivel` | Resolvido no backend; card E2 tira do front |
| B1 `ativo` duplicado | Resolvido |
| B2 URL de produção do front | Card E6 (depende da hospedagem) |
| B3 Swagger em produção | Resolvido |
| B4 `package-lock` | Regenerado com npm 11 (o do Node 24) |
| B5 e B6 arquivos vazios e sobras no front | Card E2; `log-main.txt` removido |
| B7 formatação | Resolvido (Prettier em todo o backend) |

## Arquivos novos

| Arquivo | O que é |
| --- | --- |
| `docker-compose.yml` | PostgreSQL 16 para desenvolvimento |
| `docs/banco.md` | Diagrama ER, travas do banco e como usar |
| `docs/MUDANCAS-v2.md` | Este resumo |
| `backend/database/migrations/001_criar_tabelas.sql` | Cria as 13 tabelas, índices, restrições e gatilhos |
| `backend/src/database/conexao.ts`, `migrar.ts`, `semear.ts` | Scripts `db:migrate`, `db:seed` e `db:reset` |
| `backend/src/common/configurar-app.ts` | Prefixo, helmet, validação e envelope, iguais na API e nos e2e |
| `backend/src/common/utils/data.util.ts` | Datas no fuso da escola |
| `backend/src/common/utils/codigo.util.ts` | Códigos de retirada e devolução e conteúdo do QR |
| `backend/src/common/enums/insumo.enum.ts` | Categorias, unidades, tipos e motivos de insumo |
| `backend/src/common/enums/tipo-evento-emprestimo.enum.ts` | Eventos da linha do tempo |
| `backend/src/auth/dto/login.dto.ts` | Validação do login |
| `backend/src/equipamentos/dto/filtro-equipamento.dto.ts` | Filtros e paginação |
| `backend/src/insumos/*` | Módulo registrado, entidades e seed; controller e service vazios para os cards D |
| 9 arquivos `*.spec.ts` | Testes unitários |

## Arquivos alterados

| Arquivo | Mudança |
| --- | --- |
| `README.md` | Reescrito: o projeto como está hoje, instalação em 5 minutos, banco, comandos, fluxo de Git e status |
| `docs/contrato-api.md` | Reescrito: contrato v2 com rotas, regras e situação de cada rota |
| `docs/demo-fab.md` | Aviso de que a seção 5 foi incorporada ao contrato |
| `backend/README.md` | Reescrito: instalar, banco, variáveis, scripts, regras |
| `backend/.env.example` | `NODE_ENV`, `APP_TIMEZONE`, `DATABASE_URL`, `SWAGGER_ATIVO` |
| `backend/.env` | Segredo aleatório novo (não vai para o Git) |
| `backend/package.json`, `package-lock.json` | `pg`, `@types/pg`, scripts `db:*`, versão 0.2.0 |
| `backend/vitest.config.ts` | Sem `passWithNoTests`: agora existem testes |
| `backend/src/main.ts` | Usa `configurarApp`; Swagger desligado em produção |
| `backend/src/app.module.ts` | Registra o `InsumosModule` |
| `backend/src/auth/auth.controller.ts`, `auth.service.ts` | Login com limite de tentativas e `me` |
| `backend/src/auth/strategies/jwt.config.ts` | Recusa segredo fraco em produção |
| `backend/src/auth/README.md`, `common/README.md` | Seções novas |
| `backend/src/common/enums/*` | Sem `consumivel`; `atrasado` documentado como só de resposta |
| `backend/src/common/seed/*` | Mesmos 10 equipamentos e 6 usuários da demo do front, com habilitações |
| `backend/src/usuarios/*` | Campo `habilitacoes` |
| `backend/src/equipamentos/*` | Campos do front, lista paginada, `GET /:id`, service exportado |
| `backend/src/emprestimos/*` | Campos da demo, 10 pedidos coerentes, protocolo sem repetição, `statusParaResposta` |
| `backend/test/app.e2e-spec.ts` | 12 testes do fluxo de login e acervo |

## Removidos

`log-main.txt` (vazio). A pasta `node_modules` da raiz não tem `package.json`: pode apagar.
