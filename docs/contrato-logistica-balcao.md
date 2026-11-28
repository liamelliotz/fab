# Contrato: logística do balcão (separar e guardar)

O material fica espalhado pela escola (armário de TI, laboratórios, almoxarifado). Para o professor
não esperar a coordenação ir buscar cada item, o FAB divide o trabalho em três momentos:

1. **Separar** (antes da retirada): a coordenação vê o que sai hoje e amanhã, agrupado por sala
   (roteiro), busca tudo numa volta e marca "separado". O professor vê "pronto no balcão".
2. **Entregar/receber** no balcão com o código ou QR (como já era).
3. **Guardar** (depois da devolução): o que voltou em ordem fica "a guardar" até alguém levar ao
   local de origem; marca "guardado".

Equipamentos com `retiradaNoLocal = true` (máquinas que não saem da sala) não passam por 1 nem 3:
a entrega e a devolução são feitas na própria sala, com o balcão aberto no celular.

## Campos

| Onde | Campo | Significado |
| --- | --- | --- |
| equipamento | `retiradaNoLocal` | Fica na sala |
| empréstimo | `separadoEm`, `separadoPor` | Pedido aprovado já separado |
| empréstimo | `aGuardar: [{ equipamentoId, quantidade }]` | Unidades no balcão esperando a guarda |
| empréstimo | `guardadoEm`, `guardadoPor` | Quando e quem guardou |
| requisição | `separadaEm`, `separadaPor`, `aGuardar` (número), `guardadaEm`, `guardadaPor` | O mesmo, para insumos |

## Rotas

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| `GET` | `/balcao/separacao` | admin | Aprovados (empréstimos e insumos) com itens, local de guarda e roteiro |
| `PATCH` | `/emprestimos/:id/separado` · `/requisicoes-insumo/:id/separada` | admin | `{ separado: boolean }`; evento `separado` |
| `GET` | `/balcao/guarda` | admin | O que está a guardar, com o roteiro |
| `PATCH` | `/emprestimos/:id/guardado` · `/requisicoes-insumo/:id/guardada` | admin | Limpa `aGuardar`; evento `guardado` |

## Regras

- Só pedido `aprovado` é separado; pedido só com itens "fica na sala" responde **409** (não há o que separar).
- Devolução: `aGuardar` = unidades que voltaram ao estoque (sem avaria nem falta), exceto "fica na sala".
- Pedido separado que é cancelado, recusado ou expira: os itens separados vão para `aGuardar`.
- Requisição separada entregue com quantidade menor: a diferença vai para `aGuardar`. Sobra recebida também.
- Separar e guardar **não mudam o estoque** (o saldo já está certo); mudam só o lugar físico,
  que o mapa mostra na Coordenação até a guarda.
