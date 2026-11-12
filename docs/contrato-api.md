# FAB — Contrato da API v2 (front ↔ backend)

**Este é o único contrato válido.** Ele junta o plano do backend, a demonstração do front
([`demo-fab.md`](demo-fab.md)) e o módulo novo de insumos. Os tipos do front ficam em
`frontend/src/app/core/models/`. **Se algo aqui precisar mudar, avise no card antes de codar.**

Legenda da coluna Situação: **pronto** (já funciona no código) ou o **card** do Trello que entrega.

## 1. Regras gerais

| Item | Regra |
| --- | --- |
| Endereço base | `http://localhost:3000/api` (front: `environment.apiUrl`) |
| Ids | sempre **texto** (`"usr-admin"`, UUID), nunca número |
| Datas de calendário | `AAAA-MM-DD` (ex.: `2026-11-21`). Nada de `dd/mm/aaaa` |
| Momentos | ISO 8601 completo (`2026-11-21T13:00:00.000Z`): `criadoEm`, `dataSolicitacao`, `ocorridaEm`, eventos |
| "Hoje" | o dia na escola (`APP_TIMEZONE`, padrão `America/Belem`). No backend, use `hojeIso()` |
| Status e perfis | sempre **minúsculas**, com `_` (ex.: `em_manutencao`) |
| Quantidade de insumo | número com até 3 casas decimais (ex.: `0.25`) |
| Autenticação | cabeçalho `Authorization: Bearer <token>`; toda rota pede token, exceto as públicas |
| Campos fora do DTO | são descartados em silêncio (`whitelist`). **Todo campo que o front envia precisa estar no DTO** |

### Envelope de resposta (toda resposta, inclusive erro)

```json
{ "sucesso": true, "mensagem": "texto opcional", "dados": {}, "erros": [], "timestamp": "2026-11-21T13:00:00.000Z" }
```

Em erro: `sucesso: false`, `mensagem` com o resumo e `erros` com a lista (ex.: mensagens do class-validator).

### Códigos de erro

| Código | Significado | O que o front faz |
| --- | --- | --- |
| 400 | dado inválido | mostra a lista `erros` |
| 401 | token ausente, inválido ou expirado; login errado | volta ao login |
| 403 | perfil sem permissão; conta inativa no login | volta ao dashboard |
| 404 | não encontrado | mensagem na tela |
| 409 | conflito de regra: patrimônio, e-mail, CPF ou nome repetido; estoque insuficiente; status que não permite a ação | mostra `mensagem` |
| 429 | muitas tentativas (login: 5 por minuto) | mostra `mensagem` |

### Lista paginada (`dados` de toda listagem)

Parâmetros: `pagina` (padrão 1) e `itensPorPagina` (padrão 10, máximo 100).

```json
{ "itens": [], "totalItens": 0, "paginaAtual": 1, "totalPaginas": 0, "itensPorPagina": 10, "temProxima": false, "temAnterior": false }
```

## 2. Valores fixos (enums em `backend/src/common/enums`)

| Enum | Valores |
| --- | --- |
| Perfil | `admin`, `usuario` (`responsavel_lab` está **fora** desta versão) |
| StatusUsuario | `ativo`, `inativo`, `bloqueado` |
| CategoriaEquipamento | `ferramenta`, `eletronico`, `impressora_3d`, `corte_laser`, `outros` (**`consumivel` saiu**: virou insumo) |
| StatusEquipamento | `disponivel`, `emprestado`, `em_manutencao`, `inativo`, `descartado` |
| StatusEmprestimo | `pendente`, `aprovado`, `rejeitado`, `em_andamento`, `devolvido`, `cancelado` e `atrasado` (**só na resposta**, nunca gravado) |
| TipoEventoEmprestimo | `solicitado`, `aprovado`, `rejeitado`, `cancelado`, `retirado`, `transferencia_solicitada`, `transferencia_aceita`, `transferencia_recusada`, `transferencia_cancelada`, `devolvido` |
| StatusManutencao | `avariado`, `em_assistencia`, `concluido` |
| CategoriaInsumo | `impressao_3d`, `eletronica`, `papelaria`, `limpeza`, `ferragens`, `outros` |
| UnidadeMedida | `un`, `cx`, `pct`, `rolo`, `kg`, `g`, `l`, `ml`, `m` |
| TipoMovimentacao | `entrada`, `saida` |
| MotivoMovimentacao | entrada: `compra`, `doacao`, `ajuste_positivo` · saída: `uso_em_aula`, `perda`, `vencimento`, `ajuste_negativo` |

## 3. Rotas

### 3.1 Autenticação e usuários

| Método e rota | Quem | Entrada | `dados` | Erros | Situação |
| --- | --- | --- | --- | --- | --- |
| `POST /auth/login` | público | `{ email, senha }` | `{ tokenAcesso, tipoToken: "Bearer", expiraEm, usuario }` | 400, 401, 403, 429 | pronto |
| `GET /auth/me` | logado | — | `Usuario` | 401 | pronto |
| `POST /auth/recuperar-senha` | público | `{ email }` | mensagem sempre igual | 400, 429 | A5 |
| `POST /auth/redefinir-senha` | público | `{ token, novaSenha }` (mínimo 8) | mensagem | 400 | A5 |
| `GET /usuarios` | admin | `busca`, `perfil`, `status`, paginação | página de `Usuario` | 400 | A3 |
| `GET /usuarios/resumo` | logado | `busca?` | lista de `{ id, nome, departamento, habilitacoes }` dos ativos | — | A3 |
| `GET /usuarios/:id` | admin | — | `Usuario` | 404 | A3 |
| `POST /usuarios` | admin | `nome, email, cpf, senha (mín. 8), telefone?, matricula?, departamento?, perfil?, habilitacoes?` | `Usuario` | 400, 409 | A3 |
| `PATCH /usuarios/:id` | admin | `nome?, telefone?, matricula?, departamento?, perfil?` | `Usuario` | 400, 404, 409 | A4 |
| `PATCH /usuarios/:id/status` | admin | `{ status }` | `Usuario` | 400, 404, 409 | A4 |
| `PUT /usuarios/:id/habilitacoes` | admin | `{ equipamentoIds: string[] }` (substitui a lista) | `Usuario` | 400, 404 | A4 |

**Não existe `POST /auth/cadastro`:** só o admin cria contas. `Usuario` nunca traz `senhaHash`.

### 3.2 Equipamentos e manutenção

| Método e rota | Quem | Entrada | `dados` | Erros | Situação |
| --- | --- | --- | --- | --- | --- |
| `GET /equipamentos` | logado | `busca`, `categoria`, `status`, `apenasDisponiveis`, paginação | página de `Equipamento` | 400 | pronto |
| `GET /equipamentos/:id` | logado | — | `Equipamento` | 404 | pronto |
| `POST /equipamentos` | admin | `nome, descricao, codigoPatrimonio, categoria, localizacao, fotoUrl?, requerTreinamento, quantidadeTotal, prazoMaximoDias` | `Equipamento` | 400, 409 | B2 |
| `PATCH /equipamentos/:id` | admin | os mesmos campos, opcionais (menos `codigoPatrimonio`) | `Equipamento` | 400, 404, 409 | B2 |
| `PATCH /equipamentos/:id/ativo` | admin | `{ ativo }` | `Equipamento` | 404, 409 | B2 |
| `GET /manutencoes` | admin | `status?`, `equipamentoId?`, paginação | página de `Manutencao` | 400 | B4 |
| `POST /manutencoes` | admin | `{ equipamentoId, descricao, quantidade?, assistencia?, emprestimoId? }` | `Manutencao` | 400, 404, 409 | B4 |
| `PATCH /manutencoes/:id` | admin | `{ status?, assistencia?, descricao? }` | `Manutencao` | 400, 404, 409 | B4 |

### 3.3 Empréstimos, balcão e transferência

| Método e rota | Quem | Entrada | `dados` | Erros | Situação |
| --- | --- | --- | --- | --- | --- |
| `POST /emprestimos` | logado | `{ itens: [{ equipamentoId, quantidade, observacoes? }], justificativa, dataPrevistaRetirada, dataPrevistaDevolucao }` | `Emprestimo` (pendente) | 400, 404, 409 | C2 |
| `GET /emprestimos/meus` | logado | `status?`, paginação | página de `Emprestimo` (sou solicitante, responsável ou destinatário de transferência) | 400 | C3 |
| `GET /emprestimos` | admin | `status?, solicitanteId?, dataInicio?, dataFim?, atrasadosApenas?`, paginação | página de `Emprestimo` | 400 | C3 |
| `GET /emprestimos/:id` | participante ou admin | — | `Emprestimo` | 403, 404 | C3 |
| `PATCH /emprestimos/:id/avaliar` | admin | `{ aprovado, motivo? }` | `Emprestimo` | 400, 404, 409 | C4 |
| `PATCH /emprestimos/:id/cancelar` | solicitante | — | `Emprestimo` | 403, 404, 409 | C4 |
| `GET /emprestimos/balcao/consulta` | admin | `codigo` | `{ tipo: "retirada" ou "devolucao", emprestimo }` | 400, 404 | C5 |
| `POST /emprestimos/balcao/retirada` | admin | `{ codigo }` | `Emprestimo` (em andamento) | 400, 404, 409 | C5 |
| `POST /emprestimos/balcao/devolucao` | admin | `{ codigo, houveAvaria, observacoes? }` | `Emprestimo` (devolvido) | 400, 404, 409 | C5 |
| `POST /emprestimos/:id/transferencia` | responsável atual | `{ paraId, motivo }` | `Emprestimo` | 400, 403, 404, 409 | C6 |
| `PATCH /emprestimos/:id/transferencia/aceitar` | destinatário | — | `Emprestimo` | 403, 404, 409 | C6 |
| `PATCH /emprestimos/:id/transferencia/recusar` | destinatário | `{ motivo? }` | `Emprestimo` | 403, 404, 409 | C6 |
| `DELETE /emprestimos/:id/transferencia` | quem pediu ou admin | — | `Emprestimo` | 403, 404, 409 | C6 |

Na resposta, `Emprestimo` traz objetos resumidos (`solicitante`, `responsavel`, `responsavelAprovacao`,
`historico[].por`, `itens[].equipamento`) e o `status` já com `atrasado` quando for o caso.
**Códigos:** `codigoRetirada` e `codigoDevolucao` só aparecem para o responsável atual e para o admin.

### 3.4 Insumos (todas as rotas: admin)

| Método e rota | Entrada | `dados` | Erros | Situação |
| --- | --- | --- | --- | --- |
| `GET /insumos` | `busca?, categoria?, apenasARepor?, incluirInativos?`, paginação | página de `Insumo` | 400 | D1 |
| `GET /insumos/a-repor` | — | lista de `Insumo` com `quantidadeAtual <= estoqueMinimo`, mais `faltaParaOMinimo` | — | D3 |
| `GET /insumos/:id` | — | `Insumo` | 404 | D1 |
| `POST /insumos` | `nome, categoria, unidadeMedida, estoqueMinimo, quantidadeInicial?, descricao?, fornecedor?, validade?, localizacao?` | `Insumo` | 400, 409 | D1 |
| `PATCH /insumos/:id` | `nome?, descricao?, categoria?, unidadeMedida?, estoqueMinimo?, fornecedor?, localizacao?` (**sem** quantidade) | `Insumo` | 400, 404, 409 | D1 |
| `PATCH /insumos/:id/ativo` | `{ ativo }` | `Insumo` | 404 | D1 |
| `POST /insumos/:id/movimentacoes` | `{ tipo, quantidade, motivo, observacao?, destinatarioId?, validadeLote?, ocorridaEm? }` | `{ movimentacao, insumo, alertaEstoqueBaixo }` | 400, 404, 409 | D2 |
| `GET /insumos/movimentacoes` | `dataInicio?, dataFim?, insumoId?, categoria?, tipo?`, paginação | página de `MovimentacaoInsumo` (mais recentes primeiro) | 400 | D4 |
| `GET /insumos/relatorios/consumo` | `dataInicio, dataFim, categoria?` | `RelatorioConsumo` | 400 | D5 |

`Insumo`: `id, nome, descricao?, categoria, unidadeMedida, quantidadeAtual, estoqueMinimo, fornecedor?, validade?, localizacao?, ativo, estoqueBaixo, criadoEm, atualizadoEm?`.
`MovimentacaoInsumo`: `id, insumo { id, nome, unidadeMedida }, tipo, quantidade, saldoApos, motivo, observacao?, responsavel { id, nome }, destinatario? { id, nome }, validadeLote?, ocorridaEm`.
`RelatorioConsumo`: `{ dataInicio, dataFim, dias, itens: [{ insumo { id, nome, unidadeMedida, categoria }, totalEntradas, totalConsumido, mediaDiaria, quantidadeAtual, diasRestantes, previsaoDeTermino, estoqueBaixo }] }`.

### 3.5 Dashboard e relatórios

| Método e rota | Quem | Entrada | `dados` | Situação |
| --- | --- | --- | --- | --- |
| `GET /dashboard/resumo` | logado | — | `DashboardResumo` (o professor vê só os números dele; o admin vê também `insumosARepor`) | D6 |
| `GET /relatorios/utilizacao` | admin | `dataInicio`, `dataFim` | `RelatorioUtilizacao` | D6 |

## 4. Regras de negócio

### Usuários
1. E-mail e CPF únicos (409). CPF com 11 dígitos e dígitos verificadores válidos; telefone com 10 ou 11 dígitos.
2. Só `ativo` entra no sistema. O admin não altera o próprio status nem rebaixa o próprio perfil. Sempre deve restar ao menos um admin ativo.
3. `habilitacoes` só aceita ids de equipamentos com `requerTreinamento = true`.
4. Recuperar senha responde sempre a mesma mensagem (não revela se o e-mail existe). Token de uso único, válido por 30 minutos, guardado como hash.

### Equipamentos
5. `codigoPatrimonio` único, sem diferenciar maiúsculas nem espaços nas pontas (409). Não muda depois de criado.
6. `0 <= quantidadeDisponivel <= quantidadeTotal`. Ao editar `quantidadeTotal`, o disponível acompanha a diferença; se ficaria negativo, 409.
7. `reservar(id, quantidade)` exige status `disponivel` e saldo; ao zerar, o status vira `emprestado`. `liberar` devolve o saldo (nunca acima do total) e volta para `disponivel`. Itens `em_manutencao`, `inativo` e `descartado` não mudam de status ao liberar.
8. Desativar (`ativo: false`) só com todas as unidades em casa (`quantidadeDisponivel = quantidadeTotal`); senão 409.
9. Professor não vê `inativo` nem `descartado`.

### Empréstimos
10. Fluxo: `pendente → aprovado → em_andamento → devolvido`. Saídas: `rejeitado` (com motivo) e `cancelado`.
11. Solicitar: ao menos 1 item, sem equipamento repetido, quantidade inteira maior que 0, `justificativa` com 10 a 500 caracteres, retirada de hoje em diante, devolução maior ou igual à retirada, e `devolução − retirada <= menor prazoMaximoDias` entre os itens. Equipamento precisa estar `disponivel`. Item com treinamento exige a habilitação. **Solicitar não reserva estoque.**
12. Aprovar: só `pendente`. Reserva cada item (regra 7); se faltar saldo em qualquer um, 409 "Estoque insuficiente" e nada é reservado. Gera `codigoRetirada`. Reprovar exige motivo (5 a 300 caracteres).
13. Cancelar: só o solicitante, só em `pendente`.
14. Retirada no balcão: código de pedido `aprovado`. Passa a `em_andamento`, grava `dataRetiradaEfetiva`, apaga o `codigoRetirada` e gera o `codigoDevolucao`.
15. Devolução no balcão: código de pedido `em_andamento` (atrasado também devolve). Libera o estoque, grava `dataDevolucaoEfetiva`, apaga o código e cancela a transferência pendente. Com `houveAvaria`, as observações são obrigatórias e cada item vira uma manutenção `avariado` (a unidade não volta ao disponível).
16. Códigos: 6 caracteres sem `I L O 0 1`, únicos entre os pedidos ativos, de uso único. QR: `FAB:R:<protocolo>:<codigo>` ou `FAB:D:...`.
17. Atraso: `aprovado` ou `em_andamento` com devolução prevista anterior a hoje. Calculado na leitura, nunca gravado.
18. Transferência: só o responsável atual, só `em_andamento` e **não atrasado**, uma pendente por vez, destinatário ativo e diferente, com habilitação se algum item exigir. Ao aceitar: muda o `responsavel`, **o prazo não muda** e o `codigoDevolucao` é trocado.
19. Linha do tempo: toda ação acrescenta um evento com quem fez e quando. Nunca se edita nem apaga.

### Insumos
20. Nome único, sem diferenciar maiúsculas nem espaços (409).
21. **O saldo só muda por movimentação.** `PATCH /insumos/:id` não aceita quantidade. `quantidadeInicial` no cadastro vira uma entrada `ajuste_positivo`.
22. Movimentação: `quantidade > 0`, até 3 casas decimais; `motivo` compatível com o `tipo`; `responsavel` é o admin logado (vem do token); `ocorridaEm` não pode ser no futuro; insumo inativo não movimenta (409).
23. **Saída maior que o saldo: 409** com a mensagem "Saldo insuficiente: há X <unidade> de <nome>." O saldo nunca fica negativo.
24. `destinatarioId` só em saída; `validadeLote` só em entrada. A `validade` do insumo passa a ser a menor validade entre os lotes de entrada ainda não vencidos.
25. Estoque baixo: `quantidadeAtual <= estoqueMinimo` em insumo ativo. A resposta da movimentação traz `alertaEstoqueBaixo: true` quando a saída fez o item atingir o mínimo.
26. Movimentações são só de acréscimo. Erro de lançamento se corrige com `ajuste_positivo` ou `ajuste_negativo`.
27. Relatório de consumo: `totalConsumido` soma as saídas `uso_em_aula`, `perda` e `vencimento` do período (ajustes não contam). `dias = dataFim − dataInicio + 1` (máximo 366). `mediaDiaria = totalConsumido / dias`. `diasRestantes = quantidadeAtual / mediaDiaria`, arredondado para baixo, e `previsaoDeTermino = hoje + diasRestantes`; os dois são `null` quando a média é 0.

## 5. Contas do seed

| Conta | E-mail | Senha |
| --- | --- | --- |
| Administrador | `admin@fab.com` | `admin123` |
| Professor Demonstração (habilitado na Impressora 3D) | `professor@fab.com` | `prof123` |
| João, Maria, Carlos | `joao@`, `maria@`, `carlos@escola.br` | `prof123` |
| Ana (habilitada na Impressora 3D e no Osciloscópio) | `ana@escola.br` | `prof123` |

Códigos prontos: retirada `H3Q8ZW` (Professor, EMP-2026-0040) e `K7M4PX` (Ana, 0045); devolução `W4D7KC` (Projetor, 0038),
`P8X2MJ` (Impressora 3D, 0044) e `T6R9NB` (Osciloscópio atrasado, 0037).

## 6. Ferramentas do backend

ESM (todo `import` local termina em `.js`), Vitest (`*.spec.ts` em `src/`, `*.e2e-spec.ts` em `test/`), oxlint, PostgreSQL 16
(veja [`banco.md`](banco.md)). Use sempre `@Inject(Classe)` nos construtores, como nos arquivos já prontos.
