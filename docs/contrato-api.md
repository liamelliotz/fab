# FAB — Contrato da API (front ↔ backend)

Documento de referência para quem cria rotas, DTOs e telas. Os tipos do front estão em
`frontend/src/app/core/models/` e os caminhos das rotas em
`frontend/src/app/core/constants/api.constants.ts` (`ENDPOINTS`). **Se algo aqui mudar, avise no card antes.**

## 1. Regras gerais

| Item | Regra |
| --- | --- |
| Endereço base | `http://localhost:3000/api` (front: `environment.apiUrl`) |
| Ids | sempre **texto** (`"1"`, `"usr-admin"`), nunca número |
| Datas | `AAAA-MM-DD` (ex.: `2026-10-21`). Nada de `dd/mm/aaaa` |
| Status e perfis | sempre **minúsculas**, com `_` (ex.: `em_manutencao`) |
| Autenticação | cabeçalho `Authorization: Bearer <token>`; toda rota pede token, exceto as marcadas como públicas |
| Dados que não existem no DTO | são descartados em silêncio (`whitelist`). **Todo campo que o front envia precisa estar no DTO** |

### Envelope de resposta (toda resposta, inclusive erro)

```json
{ "sucesso": true, "mensagem": "texto opcional", "dados": {}, "erros": [], "timestamp": "2026-10-21T10:00:00.000Z" }
```

Em erro: `sucesso: false`, `mensagem` com o resumo e `erros` com a lista (ex.: mensagens do class-validator).

### Códigos de erro que o front trata

| Código | Significado | O que o front faz |
| --- | --- | --- |
| 400 | dado inválido | mostra a lista `erros` |
| 401 | token ausente, inválido ou expirado | volta ao login |
| 403 | perfil sem permissão | volta ao dashboard |
| 404 | não encontrado | mensagem na tela |
| 409 | conflito (patrimônio ou e-mail repetido, estoque insuficiente) | mostra `mensagem` |

### Lista paginada (`dados` de toda listagem)

Parâmetros de consulta: `pagina` (padrão 1) e `itensPorPagina` (padrão 10, máximo 100).

```json
{ "itens": [], "totalItens": 0, "paginaAtual": 1, "totalPaginas": 0, "itensPorPagina": 10, "temProxima": false, "temAnterior": false }
```

## 2. Valores fixos (enums)

| Enum | Valores |
| --- | --- |
| Perfil | `admin`, `usuario` (o front também conhece `responsavel_lab`, **fora do escopo** desta etapa) |
| StatusUsuario | `ativo`, `inativo`, `bloqueado` |
| CategoriaEquipamento | `ferramenta`, `eletronico`, `impressora_3d`, `corte_laser`, `consumivel`, `outros` |
| StatusEquipamento | `disponivel`, `emprestado`, `em_manutencao`, `inativo`, `descartado` |
| StatusEmprestimo | `pendente`, `aprovado`, `rejeitado`, `em_andamento`, `devolvido`, `atrasado`, `cancelado` |
| StatusManutencao | `avariado`, `em_assistencia`, `concluido` |

## 3. Decisões de contrato (usuários, cadastro e senha)

Combinadas para os Cards 4, 5, 7 e 9. Vêm do que o front já envia e exibe.

1. **Usuário** tem os campos do front: `id`, `nome`, `email`, `cpf` (obrigatório), `telefone?`, `matricula?`,
   `departamento?`, `perfil`, `status`, `criadoEm`, `atualizadoEm?`. A entidade do backend precisa de **todos**.
   O `senhaHash` nunca sai em resposta.
2. **`POST /auth/cadastro`** (público) recebe `nome`, `email`, `cpf`, `senha` e, opcionais, `telefone`,
   `matricula` e `departamento`. O `perfil` enviado é **ignorado**: quem se cadastra é sempre `usuario`.
   - `cpf`: 11 dígitos, com validação dos dígitos verificadores (o front envia só números).
   - `telefone`: 10 ou 11 dígitos (o front envia só números).
   - E-mail ou CPF já cadastrado: **409**.
3. **Senha: mínimo de 8 caracteres** no cadastro (o front já valida 8). O **login não tem mínimo**:
   quem decide é o 401. O `LoginDto` só exige e-mail e senha preenchidos.
4. **Status `bloqueado`**: entra no enum do backend (o front já o conhece). Só `ativo` consegue logar.
   `PATCH /usuarios/:id/status` aceita `ativo`, `inativo` e `bloqueado`. O admin não altera o próprio status.
5. **Token JWT** leva `sub` (id), `email` e `perfil` (minúsculo, como no enum). O front lê o `perfil` do token.
6. **Resposta do login** (`AuthResponse`): `{ tokenAcesso, tipoToken: "Bearer", expiraEm (segundos), usuario }`.
7. **Contas do seed** (iguais às do modo demonstração do front): `admin@fab.com` / `admin123` (admin) e
   `professor@fab.com` / `prof123` (usuario).

## 4. Rotas

| Método e rota | Quem acessa | Corpo / parâmetros | `dados` da resposta |
| --- | --- | --- | --- |
| `POST /auth/login` | público | `{ email, senha }` | `AuthResponse` |
| `POST /auth/cadastro` | público | ver seção 3 | usuário criado (sem senha) |
| `POST /auth/recuperar-senha` | público | `{ email }` | mensagem genérica |
| `POST /auth/redefinir-senha` | público | `{ token, novaSenha }` (mínimo 8) | mensagem |
| `GET /auth/me` | logado | — | `Usuario` |
| `GET /usuarios` | admin | `busca`, `perfil`, `status`, paginação | `RespostaPaginada<Usuario>` |
| `PATCH /usuarios/:id` | admin | `AtualizarUsuarioDTO` | `Usuario` |
| `PATCH /usuarios/:id/status` | admin | `{ status }` | `Usuario` |
| `GET /equipamentos` | logado | `busca`, `categoria`, `status`, `apenasDisponiveis`, paginação | `RespostaPaginada<Equipamento>` |
| `GET /equipamentos/:id` | logado | — | `Equipamento` |
| `POST /equipamentos` | admin | `CriarEquipamentoDTO` | `Equipamento` |
| `PATCH /equipamentos/:id` | admin | `AtualizarEquipamentoDTO` | `Equipamento` |
| `PATCH /equipamentos/:id/ativo` | admin | `{ ativo }` | `Equipamento` |
| `POST /emprestimos` | logado | `SolicitarEmprestimoDTO` | `Emprestimo` (pendente) |
| `GET /emprestimos/meus` | logado | `status`, paginação | `RespostaPaginada<Emprestimo>` |
| `GET /emprestimos` | admin | `FiltroEmprestimoDTO`, paginação | `RespostaPaginada<Emprestimo>` |
| `GET /emprestimos/:id` | dono ou admin | — | `Emprestimo` |
| `PATCH /emprestimos/:id/avaliar` | admin | `{ aprovado, motivo? }` (motivo obrigatório ao reprovar) | `Emprestimo` |
| `PATCH /emprestimos/:id/cancelar` | dono | — | `Emprestimo` |
| `PATCH /emprestimos/:id/retirada` | admin | — | `Emprestimo` |
| `PATCH /emprestimos/:id/devolucao` | admin | `RegistrarDevolucaoDTO` | `Emprestimo` |
| `GET /manutencoes` | admin | paginação | `RespostaPaginada<Manutencao>` |
| `POST /manutencoes` | admin | `RegistrarManutencaoDTO` | `Manutencao` |
| `PATCH /manutencoes/:id` | admin | `AtualizarManutencaoDTO` | `Manutencao` |
| `GET /dashboard/resumo` | logado | — | `DashboardResumo` |
| `GET /relatorios/utilizacao` | admin | `dataInicio`, `dataFim` | `RelatorioUtilizacao` |

Os tipos citados estão em `frontend/src/app/core/models/` (`manutencao`, `relatorio` e `dashboard` são novos).

## 5. Ferramentas do backend

O projeto real usa **ESM, Vitest e oxlint** (e não Jest e ESLint, como no plano). Detalhes no
`backend/README.md`. Em resumo: todo `import` local termina em `.js`, os testes unitários são `*.spec.ts`
e os e2e usam `backend/vitest.config.e2e.ts`.
