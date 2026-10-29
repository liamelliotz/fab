# FAB — Demo do front: ciclo completo, realocação e auditoria

Este documento explica o que a demonstração mostra, como apresentar e o que o backend precisa
entregar para virar produção. A demo roda **só no front** (sem backend), com dados salvos no navegador.

## 1. O que é novo

| # | Recurso | Onde ver |
| --- | --- | --- |
| 1 | **Ciclo completo do pedido**: solicitar → aprovar (gera código) → retirada no balcão → devolução | Solicitar, Solicitações, Balcão |
| 2 | **Código e QR** na retirada **e** na devolução (o QR é gerado no próprio front) | Detalhes do pedido (`/pedidos/:id`) |
| 3 | **Linha do tempo** de cada pedido: quem fez o quê e quando (auditoria) | Detalhes do pedido |
| 4 | **Realocação (transferência) entre professores**, com aceite do destinatário | Meus pedidos, Detalhes |
| 5 | **Prazo máximo por material** (ninguém fica com o item o ano todo) | Equipamentos (admin), Solicitar |
| 6 | **Habilitação para equipamentos com treinamento** | Usuários (admin) |
| 7 | **Cadastro só pelo administrador** (saiu da tela de login) | Usuários → Novo usuário |
| 8 | Avisos para a coordenação e bolinhas de novidade no menu | Empréstimos, menu lateral |

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
| Professor Demonstração | `professor@fab.com` | `prof123` | Tem pedidos em todas as situações; habilitado na Impressora 3D |
| João, Maria, Carlos, Ana | `joao@`, `maria@`, `carlos@`, `ana@escola.br` | `prof123` | Colegas para receber transferências (só a **Ana** é habilitada na Impressora 3D) |

A barra amarela **"Modo demonstração"** (topo das telas internas) troca de usuário com um clique, sem digitar
senha, e tem o botão **Reiniciar dados**. Use-o para mostrar os dois lados de cada fluxo.

Pedidos prontos para o professor: um **aprovado** (código `H3Q8ZW`, para retirar), dois **em andamento**
(Projetor e Impressora 3D, para transferir), uma **transferência recebida** de Carlos (para aceitar), um devolvido e um reprovado.
Outros: pedido da **Ana** aprovado (código `K7M4PX`), pedido **atrasado** da Maria (não transfere) e o **EMP-2026-0036**
já devolvido com cadeia João → Maria (para mostrar a linha do tempo completa).

## 4. Roteiro de apresentação (≈ 6 minutos)

1. **Admin cria um professor** (Usuários → Novo usuário). Mostre a senha provisória e que o login não tem mais cadastro público.
2. **Prazo por material** (Equipamentos → editar o Projetor: prazo 3 dias). Entre como professor e tente pedir o projetor por 5 dias: o sistema barra e mostra a data limite.
3. **Ciclo:** como professor, peça um material → admin aprova em *Solicitações* → professor vê o **código e o QR** em *Meus pedidos* → admin abre o **Balcão**, digita o código e confirma a entrega.
4. **Realocação:** como professor, abra o **Projetor** (em andamento) → *Transferir* → Maria, com motivo. Tente a **Impressora 3D**: João, Maria e Carlos aparecem bloqueados (sem habilitação) e a Ana está liberada.
5. **Entre como Maria** (barra de demonstração) → aceite. Mostre que o **prazo continuou o mesmo** e que o código de devolução mudou.
6. **Entre como admin** → *Empréstimos*: aviso da transferência, atrasos e quem está com cada coisa. Abra o **EMP-2026-0036**: **linha do tempo** e cadeia de responsáveis.
7. **Devolução** no Balcão com o código novo (marque "avaria" para mostrar o registro).

## 5. O que o backend precisa para virar produção

| Tema | Mudança no contrato |
| --- | --- |
| Cadastro | `POST /auth/cadastro` deixa de ser público. Criação de conta passa a ser **`POST /usuarios` (admin)**. O login continua igual. |
| Usuário | Campo `habilitacoes: string[]` (ids de equipamentos). Admin concede/retira. |
| Equipamento | Campo `prazoMaximoDias` (obrigatório, 1–365). A API valida `dataPrevistaDevolucao − dataPrevistaRetirada ≤ prazo` (menor prazo entre os itens). |
| Empréstimo | Novos campos: `responsavel`, `historico[]` (evento: `tipo`, `em`, `por`, `detalhe`), `codigoRetirada`, `codigoDevolucao`, `transferenciaPendente`, `dataRetiradaEfetiva`. |
| Códigos | 6 caracteres sem `I L O 0 1`, uso único, gerados na aprovação (retirada) e na retirada (devolução). **Trocar o de devolução a cada transferência aceita.** Conteúdo do QR: `FAB:R:<protocolo>:<codigo>` ou `FAB:D:<protocolo>:<codigo>`. |
| Balcão | `POST /emprestimos/balcao/retirada` e `/devolucao` (admin) recebendo o código; exceção manual registrada no histórico. |
| Transferência | `POST /emprestimos/:id/transferencia` (responsável), `PATCH .../transferencia/aceitar` e `/recusar` (destinatário), `DELETE .../transferencia` (quem pediu ou admin). Mesmas regras da seção 2. |
| Auditoria | `historico` é **só de acréscimo** (nunca editar nem apagar). |

## 6. Limites da demo (para não prometer o que não existe)

- Os dados ficam no **navegador** (localStorage): cada computador tem os seus. Não há envio real de e-mail.
- As **senhas da demo ficam em texto** no navegador. Com o backend, só o hash existe (Card 4).
- O QR é gerado no front; o **leitor** é o USB (ele "digita" o código no campo do Balcão). Ler por câmera fica para a versão com app/PWA.

## 7. Ideias para ir além (se sobrar tempo)

- **Vários laboratórios ou escolas** no mesmo sistema (campo `laboratorioId` em tudo).
- **Retirada vencida**: pedido aprovado e não retirado em 2 dias volta ao estoque sozinho.
- **Lembrete automático** 1 dia antes do vencimento e relatório de reincidência de atrasos.
- Leitura de QR pela câmera do celular (PWA).
