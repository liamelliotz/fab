# FAB | Roteiro da demonstração

Este documento tem duas partes: a **demonstração integrada**, com frontend e backend ligados, e a [**demonstração sem backend**](#parte-2--demonstração-sem-backend-npm-run-demo) (`npm run demo`).

# Parte 1 — Demonstração integrada

**Ensaio completo pendente.** Execute este roteiro com frontend e backend ligados, usando um ambiente de teste. Na execução do E5 de 17/11, os cadastros de equipamento e insumo retornaram 404. Confirme essas operações na versão de apresentação antes de começar o ensaio.

## Preparação

1. Siga o [README da raiz](../README.md) e inicie o backend e o frontend em terminais separados. Anote o commit usado e o modo de persistência. Para mostrar que dados sobrevivem a reinícios, prepare um PostgreSQL de teste.
2. Abra o Swagger em <http://localhost:3000/api/docs>. Confira o login, as rotas de empréstimos e os cadastros de equipamento e insumo. Prepare um administrador, dois professores, um equipamento disponível e um insumo de teste.
3. Abra a interface e confirme no painel **Rede** que o login e as operações passam pela API. Prepare sessões separadas para os perfis ou troque de conta durante o ensaio.

## Sequência de apresentação

| O que mostrar | Ação | Resultado a conferir |
| --- | --- | --- |
| Solicitação e aprovação | Professor solicita um equipamento. Admin aprova em Solicitações. | Pedido aprovado e código de retirada disponível ao responsável. |
| Retirada no balcão | Admin consulta o código e confirma a entrega. | Pedido em andamento e código de devolução disponível. |
| Transferência | Professor responsável inicia a transferência. Segundo professor aceita. | Responsável e código de devolução mudam. Prazo de devolução é mantido. |
| Devolução e manutenção | Admin usa o novo código, informa avaria com observação e depois conclui a manutenção. | Linha do tempo registra os eventos do empréstimo. O equipamento volta ao estoque após a conclusão. |
| Saída de insumo no balcão | Selecione um insumo com saldo 5 e mínimo 2. Registre saída de 3 unidades com motivo. | Saldo 2, alerta de estoque baixo e item na lista a repor. |
| Histórico e previsão de término | Abra o histórico do insumo, filtre o período e consulte o relatório de consumo para o mesmo intervalo, incluindo a saída. | Movimento registrado, consumo e saldo atual visíveis. Confira a previsão retornada pelo backend quando houver consumo suficiente para calculá-la. |

Se a tela do insumo ainda estiver pendente, use a operação equivalente no Swagger para diagnosticar o backend e registre a tela como pendência do ensaio integrado. O contrato descreve os campos e as regras de cada operação. Consulte [contrato da API](contrato-api.md).

## Registro do ensaio

Registre data, commit, ambiente, resultado de cada etapa e links para as evidências. Marque o ensaio completo no Trello depois de executar da primeira à última etapa com a API ligada. Peça a uma pessoa de fora do grupo que instale a partir de um clone limpo usando o README e registre qualquer passo que precisou de ajuda.

---

# Parte 2 — Demonstração sem backend (`npm run demo`)

Esta parte vale para a apresentação **sem backend**, com dados salvos no navegador. Para abrir: `cd frontend` e `npm run demo` (desde o card A6, o `npm start` usa o login real da API).

## 1. O que é novo

| # | Recurso | Onde ver |
| --- | --- | --- |
| 1 | **Ciclo completo do pedido**: solicitar → aprovar (gera código) → retirada no balcão → devolução | Solicitar, Solicitações, Balcão |
| 2 | **Código e QR** na retirada **e** na devolução (o QR é gerado no próprio front) | Detalhes do pedido (`/pedidos/:id`) |
| 3 | **Linha do tempo** de cada pedido: quem fez o quê e quando (auditoria) | Detalhes do pedido |
| 4 | **Realocação (transferência) entre professores**, com aceite do destinatário | Meus pedidos, Detalhes |
| 5 | **Prazo máximo por material** (ninguém fica com o item o ano todo) | Inventário › Equipamentos (admin), Solicitar |
| 6 | **Habilitação para equipamentos com treinamento** | Usuários (admin) |
| 7 | **Cadastro só pelo administrador** (saiu da tela de login) | Usuários → Novo usuário |
| 8 | Avisos para a coordenação e bolinhas de novidade no menu | Empréstimos, menu lateral |
| 9 | **Mapa de itens** da escola fictícia (*Escola Estadual Modelo FAB*): onde cada unidade está, com quem e desde quando, e a busca **Onde está?** | Mapa de itens |
| 10 | **Local de uso** informado no pedido, confirmado no balcão e trocado só com transferência aceita | Solicitar, Balcão, Transferir |
| 11 | **Termo de responsabilidade** aceito na retirada (sem ele o balcão não entrega) | Balcão |
| 12 | **Baixa patrimonial auditada**: motivo, parecer, laudo, processo/BO, valor, ciência do responsável, confirmação pelo patrimônio e **termo de baixa** para imprimir | Manutenção, Auditoria |
| 13 | **Gestão de insumos**: saldo, estoque mínimo, entradas (NF, doação), saídas com professor, local e finalidade, perdas, previsão de término e CSV | Inventário › Insumos |
| 14 | **Auditoria do patrimônio**: trilha única e somente-leitura de empréstimos, manutenção, baixas e insumos, com filtros e exportação CSV | Auditoria |
| 15 | **Cancelamento com motivo**: pedido pendente ou aprovado só é cancelado com justificativa (mínimo de 10 caracteres), que aparece no pedido, na linha do tempo e na auditoria | Meus pedidos / Detalhes |
| 16 | **Requisição de insumos pelo professor**: em *Inventário › Insumos*; o professor informa a quantidade prevista, o dia, o local e a finalidade; a coordenação aprova (reserva), entrega (saída do estoque com o protocolo REQ) e registra a sobra (consumo real). Recusa e cancelamento exigem motivo; tudo vai para a auditoria | Inventário › Insumos e Meus pedidos › Insumos (professor) / Solicitações › Insumos (coordenação) |
| 17 | **Inventário único**: equipamentos (empréstimo) e insumos (consumo) numa só aba, com duas partes; o menu do professor ficou com 4 itens e o da coordenação com 11 | Inventário |
| 18 | **Mapa aprimorado**: indicadores clicáveis (lista tudo em uso, guardado, em manutenção ou não localizado), planta compacta com destaque de uso e manutenção, link *Mapa* em cada equipamento do inventário e exportação do **inventário por sala** em CSV | Mapa de itens |
| 19 | **Relatórios com dados reais**: retiradas no balcão e consumo de insumos do período (abre com os últimos 30 dias), sem dados de exemplo fixos | Relatórios |
| 20 | **Navegação organizada**: menu lateral com nomes e grupos (Operação, Acervo, Gestão), usuário e acessibilidade no rodapé; vira só ícones em telas médias e faixa no topo no celular | Todas |
| 21 | **Painel "O que fazer agora"**: lista única, do mais urgente ao menos urgente (atrasos, pedidos, balcão de hoje, manutenção, insumos a repor), com o botão que leva direto à ação; resumo do acervo ao lado | Painel |
| 22 | **Sem aparência de protótipo**: nenhum aviso de demonstração na tela. Restaurar os dados iniciais continua no atalho Ctrl + Alt + Shift + R | Todas |
| 23 | **Valor do patrimônio**: equipamento e insumo têm valor unitário obrigatório; a **baixa calcula o valor sozinha** (valor × unidades), sem digitação | Inventário / Manutenção |
| 24 | **Insumo perecível**: marcar como perecível obriga a validade no cadastro e em cada compra | Inventário › Insumos |
| 25 | **Assistências credenciadas**: cadastro com CNPJ validado, especialidades e prazo; o conserto só vai para quem está em dia e conserta aquela categoria | Manutenção › Assistências credenciadas |
| 26 | **VLibras e NVDA**: tradutor de Libras do Governo Federal (liga e desliga em Acessibilidade) e anúncio de troca de página para leitores de tela | Todas |
| 27 | **Pedido aprovado expira**: se não for retirado até o prazo (padrão: 1 dia depois da data de retirada), o sistema cancela e devolve a reserva ao estoque. Exemplo: EMP-2026-0033 | Solicitações / Pedido |
| 28 | **Limite por categoria**: o Pedro já está com a impressora 3D e o limite é 1; ao pedir outra, o formulário avisa e não envia | Nova solicitação |
| 29 | **Política de atraso**: a Maria está com a caixa de som atrasada e não consegue fazer pedidos. Ao devolver o EMP-2026-0037 no balcão (código `M2N9QD`), ela fica **suspensa por 6 dias** (3 de atraso × 2) automaticamente | Balcão / Usuários |
| 30 | **Regras configuráveis**: prazo para retirar, limites e política de atraso mudam em Configurações (só a coordenação); cada mudança vai para a Auditoria | Configurações |
| 32 | **Insumo pelo balcão, com código e QR**: requisição aprovada gera o código de retirada (ex.: Jumpers do Pedro, `J5P-7RQ`). No Balcão › Retirada a coordenação confere o código, entrega e o professor recebe o **código de devolução da sobra**. No Balcão › Devolução: "Sobrou" (volta ao estoque) ou "Usou tudo" | Meus pedidos › Insumos / Balcão |
| 33 | **Prazos do insumo**: aprovada não retirada até o dia de uso (+ tolerância das regras) expira e libera a reserva; a sobra pode voltar por 7 dias, depois o consumo é considerado integral | Solicitações › Insumos |
| 31 | **Modo escuro e fonte de leitura fácil**: Acessibilidade › Tema (Claro, Escuro ou Automático) e fonte Atkinson Hyperlegible. Tudo embutido: funciona sem internet | Todas |

## 2. Regras da realocação (transferência)

1. O professor A abre um pedido **em andamento** (já retirado) e escolhe **Transferir** para o professor B, com um motivo.
2. **Até B aceitar, A continua responsável.** B vê o pedido em *Meus pedidos* (e uma bolinha no menu) e aceita ou recusa.
3. Ao aceitar: B vira o responsável, **o prazo de devolução não muda**, o **código de devolução é trocado** (A não consegue mais devolver por ele) e a coordenação é avisada.
4. **Bloqueios:** pedido **atrasado** não transfere; equipamento que **exige treinamento** só vai para quem tem a **habilitação**; só uma transferência pendente por vez; só o responsável atual transfere.
5. Se o material é devolvido com uma transferência pendente, ela é cancelada automaticamente.
6. Tudo vira evento na linha do tempo, formando a **cadeia de responsáveis** (ex.: João → Maria).

> Interpretação adotada: "realocar" = passar um equipamento emprestado de um professor para outro sem
> voltar ao laboratório. Se o professor quis dizer outra coisa (por exemplo, realocar professores em
> horários e turmas do laboratório), a base de usuários, perfis e linha do tempo continua valendo.

## 3. Contas e dados de exemplo

| Conta | E-mail | Senha | Papel na demo |
| --- | --- | --- | --- |
| Administrador | `admin@fab.com` | `admin123` | Aprova, usa o balcão, gerencia usuários |
| Pedro Almeida (professor) | `professor@fab.com` | `prof123` | Tem pedidos em todas as situações; habilitado na Impressora 3D |
| João, Maria, Carlos, Ana | `joao@`, `maria@`, `carlos@`, `ana@escola.br` | `prof123` | Colegas para receber transferências (só a **Ana** é habilitada na Impressora 3D) |

**Antes de apresentar:** em qualquer tela do sistema (inclusive no login), aperte
**Ctrl + Alt + Shift + R** e confirme: tudo volta ao estado inicial e as outras abas abertas são
atualizadas na hora. Não há botão na tela, de propósito. (*Ctrl + Shift + R* não serve: o navegador
usa esse atalho para recarregar a página.)

**Duas abas, um perfil em cada:** o login vale **por aba** e é feito digitando e-mail e senha.
Abra uma aba como professor e outra como coordenação; o que uma faz aparece na outra sem recarregar,
e o F5 não troca quem está logado.

Pedidos prontos para o professor: um **aprovado** (código `H3Q8ZW`, para retirar), dois **em andamento**
(Projetor e Impressora 3D, para transferir), uma **transferência recebida** de Carlos (para aceitar), um devolvido e um reprovado.
Outros: pedido da **Ana** aprovado (código `K7M4PX`), pedido **atrasado** da Maria (não transfere) e o **EMP-2026-0036**
já devolvido com cadeia João → Maria (para mostrar a linha do tempo completa).

## 3.1 Avarias e faltas (gestão de manutenção)

| Situação na devolução (Balcão) | O que acontece com a unidade |
| --- | --- |
| Tudo em ordem | Volta ao estoque |
| Avaria **leve** | Fica registrada e **volta ao estoque** (pode ser emprestada) |
| Avaria **moderada** ou **grave** | Vai para **manutenção**: sai do estoque e fica **bloqueada** para empréstimo |
| **Falta** (não voltou) | Vira **extravio**: sai do estoque até ser encontrada ou ter baixa |

- Cada avaria tem **tipo, gravidade, descrição e foto opcional** (a foto é reduzida para caber no navegador).
- Só a **unidade** com problema sai do estoque: um notebook avariado não bloqueia os outros 9.
  O item só fica "Em manutenção" quando **todas** as unidades estão fora.
- **Quem estava com o item** fica gravado na ocorrência, na **linha do tempo do pedido** e no
  **histórico do equipamento** (*Inventário › Equipamentos → Histórico*).
- Na tela **Manutenção**, a coordenação envia para conserto, marca como **consertado/encontrado**
  (a unidade volta ao estoque) ou **dá baixa** (sai do acervo, com motivo). O desfecho também entra
  na linha do tempo do pedido.
- Dados de exemplo: a **Parafusadeira** (2 unidades) está no conserto, então não aparece para pedir;
  a **Caixa de som** tem uma avaria leve antiga (EMP-2026-0035).

**Para o backend:** contrato em `frontend/src/app/core/models/manutencao.model.ts`
(`Manutencao`, `RegistroAvariaDTO`) e novo campo `quantidadeEmManutencao` no equipamento.

## 3.2 Mapa, auditoria e insumos

- **O mapa nunca é editado à mão.** Cada unidade aparece em exatamente um lugar, calculado pelos
  registros: guardada no local de guarda (deduzido da *Localização* do equipamento), reservada para
  um pedido aprovado, em uso no local do pedido/balcão/transferência, na sala de manutenção, na
  assistência técnica ou "não localizada" (falta aberta). Os insumos aparecem no local onde ficam guardados.
- **Escola fictícia:** Bloco A (Salas 101 a 104 e Auditório), Bloco B (Lab. de Informática, Lab. Maker,
  Lab. de Ciências, Lab. de Eletrônica e Biblioteca), Bloco C (Coordenação, Almoxarifado de TI,
  Sala dos Professores e Sala de Manutenção) e Quadra. A lista fica em
  `frontend/src/app/core/constants/escola-modelo.constants.ts` e vira o cadastro de locais na API.
- **Baixa auditada:** gera o termo `TB-AAAA-NNNN`, que nunca muda. Furto/roubo exige o número do BO;
  quando havia alguém com o item, a coordenação confirma que a pessoa foi informada. Exemplo pronto:
  **TB-2026-0001** (Notebook Lenovo, conserto inviável).
- **Insumos:** o saldo só muda por movimentação e nunca fica negativo. O uso em aula exige professor,
  local e finalidade. Exemplos: **Filamento PLA**, **Jumpers** e **Toner** já estão "a repor".

## 4. Roteiro de apresentação (≈ 6 minutos)

1. **Admin cria um professor** (Usuários → Novo usuário). Mostre a senha provisória e que o login não tem mais cadastro público.
2. **Prazo por material** (Inventário › Equipamentos → editar o Projetor: prazo 3 dias). Entre como professor e tente pedir o projetor por 5 dias: o sistema barra e mostra a data limite.
3. **Ciclo:** como professor, peça um material → admin aprova em *Solicitações* → professor vê o **código e o QR** em *Meus pedidos* → admin abre o **Balcão**, digita o código e confirma a entrega.
4. **Realocação:** como professor, abra o **Projetor** (em andamento) → *Transferir* → Maria, com motivo. Tente a **Impressora 3D**: João, Maria e Carlos aparecem bloqueados (sem habilitação) e a Ana está liberada.
5. **Entre como Maria** (saia e entre com `maria@escola.br`) → aceite. Mostre que o **prazo continuou o mesmo** e que o código de devolução mudou.
6. **Entre como admin** → *Empréstimos*: aviso da transferência, atrasos e quem está com cada coisa. Abra o **EMP-2026-0036**: **linha do tempo** e cadeia de responsáveis.
7. **Devolução** no Balcão com o código novo: escolha *Com avaria ou falta*, marque 1 avariada (gravidade **grave**, com foto) e mostre em **Manutenção** a unidade bloqueada; depois *Consertado* e ela volta ao estoque.
8. **Mapa de itens:** busque "lenovo" em *Onde está?*. Volte ao Balcão, entregue o pedido da Ana (código `K7M4PX`) escolhendo **Sala 104** e aceitando o termo; no mapa, as 2 unidades passam do Almoxarifado de TI para a Sala 104.
9. **Baixa auditada:** em *Manutenção*, dê baixa na Parafusadeira (motivo, parecer e o patrimônio `PAT-0007` para confirmar) e imprima o **termo de baixa**.
10. **Insumos:** registre a saída de 1 rolo de Filamento PLA para um professor no Lab. Maker; mostre o alerta de estoque mínimo e a previsão de término. Termine na **Auditoria**, filtrando por *Baixa patrimonial* e exportando o CSV.

## 5. O que o backend precisa para virar produção

> **Atualização (v2, 11/11/2026):** tudo desta seção foi incorporado ao contrato oficial,
> [`contrato-api.md`](contrato-api.md). Em caso de diferença, vale o contrato.

| Tema | Mudança no contrato |
| --- | --- |
| Cadastro | `POST /auth/cadastro` deixa de ser público. Criação de conta passa a ser **`POST /usuarios` (admin)**. O login continua igual. |
| Usuário | Campo `habilitacoes: string[]` (ids de equipamentos). Admin concede/retira. |
| Equipamento | Campo `prazoMaximoDias` (obrigatório, 1–365). A API valida `dataPrevistaDevolucao − dataPrevistaRetirada ≤ prazo` (menor prazo entre os itens). |
| Empréstimo | Novos campos: `responsavel`, `historico[]` (evento: `tipo`, `em`, `por`, `detalhe`), `codigoRetirada`, `codigoDevolucao`, `transferenciaPendente`, `dataRetiradaEfetiva`. |
| Códigos | 6 caracteres sem `I L O 0 1`, uso único, gerados na aprovação (retirada) e na retirada (devolução). **Trocar o de devolução a cada transferência aceita.** Conteúdo do QR: `FAB:R:<protocolo>:<codigo>` ou `FAB:D:<protocolo>:<codigo>`. |
| Balcão | `POST /emprestimos/balcao/retirada` e `/devolucao` (admin) recebendo o código (obrigatório: não existe registro sem código). |
| Transferência | `POST /emprestimos/:id/transferencia` (responsável), `PATCH .../transferencia/aceitar` e `/recusar` (destinatário), `DELETE .../transferencia` (quem pediu ou admin). Mesmas regras da seção 2. |
| Auditoria | `historico` é **só de acréscimo** (nunca editar nem apagar). |

## 6. Limites da demo (para não prometer o que não existe)

- Os dados ficam no **navegador** (localStorage): cada computador tem os seus. Não há envio real de e-mail.
- As **senhas da demo ficam em texto** no navegador. Com o backend, só o hash existe (Card 4).
- **Sem código não há retirada nem devolução.** Se o professor perder o código, ele o vê de novo em *Meus pedidos* (com o QR).
- **Mapa, auditoria e insumos** ainda usam os dados da demonstração mesmo com `npm start`: as rotas de locais, auditoria e insumos (cards D) ainda não ligam essas telas à API.
- O QR é gerado no front; o **leitor** é o USB (ele "digita" o código no campo do Balcão). Ler por câmera fica para a versão com app/PWA.

## 7. Ideias para ir além (se sobrar tempo)

- **Vários laboratórios ou escolas** no mesmo sistema (campo `laboratorioId` em tudo).
- **Retirada vencida**: pedido aprovado e não retirado em 2 dias volta ao estoque sozinho.
- **Lembrete automático** 1 dia antes do vencimento e relatório de reincidência de atrasos.
- Leitura de QR pela câmera do celular (PWA).
