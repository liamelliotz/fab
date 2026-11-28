# Contrato: requisição de insumo com código no balcão

O professor pede um insumo com quantidade prevista; a retirada e a sobra passam pelo **balcão**,
com código de 6 caracteres e QR, igual aos empréstimos. Na demonstração já funciona no navegador
(`RequisicaoInsumoService`); aqui está o que a API precisa fazer. Todas as regras são do servidor.

## Ciclo

```
pendente → aprovada (reserva + codigoRetirada) → entregue (saída no estoque + codigoDevolucao)
         → sobra devolvida (entrada) ou "usou tudo" (quantidadeDevolvida = 0)
pendente/aprovada → recusada (motivo) | cancelada (motivo do professor, ou expirada pelo sistema)
```

## Rotas

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| `POST` | `/requisicoes-insumo` | professor | Cria (quantidade ≤ disponível = saldo − reservado) |
| `PATCH` | `/requisicoes-insumo/:id/aprovar` | admin | Reserva e gera `codigoRetirada` |
| `PATCH` | `/requisicoes-insumo/:id/recusar` | admin | Motivo ≥ 10 caracteres; apaga o código |
| `PATCH` | `/requisicoes-insumo/:id/cancelar` | dono | Motivo ≥ 10 caracteres; apaga o código |
| `GET` | `/balcao/codigo/:codigo` | admin | Diz se o código é de empréstimo ou de insumo, e se é de retirada ou de devolução |
| `POST` | `/requisicoes-insumo/retirada` | admin | `{ codigo, quantidade }`: confere o código, registra a saída (uso em aula) e gera `codigoDevolucao` |
| `POST` | `/requisicoes-insumo/sobra` | admin | `{ codigo, quantidade }`: 0 = usou tudo; > 0 = entrada no estoque com o protocolo |

## Regras

- **Códigos únicos no balcão:** um código nunca repete outro em uso, nem de empréstimo nem de insumo
  (índice único parcial em uma tabela/visão de códigos ativos). Alfabeto sem 0/O, 1/I/L.
- **Retirada:** só com o código da requisição `aprovada`; quantidade > 0, ≤ aprovada e ≤ saldo;
  unidades inteiras (un, cx, pct, rolo) não aceitam fração. Depois da entrega o código de retirada deixa de valer.
- **Sobra:** só com o código de devolução; 0 ≤ quantidade ≤ entregue; registra uma vez só.
  A entrada leva `documento = protocolo` e **desconta do consumo** nos relatórios.
- **Prazo para retirar:** `dataUso + diasParaRetirar` (das regras de empréstimo). Passou → job muda para
  `cancelada`, motivo "Expirou…", evento `expirada` assinado pelo sistema; a reserva volta. Retirada com código vencido → **409**.
- **Prazo da sobra:** 7 dias depois do dia de uso (ou da entrega, se for depois). Passou → job encerra com
  `quantidadeDevolvida = 0` (consumo integral) e evento `encerrada`; o código de devolução deixa de valer.
- Todo evento entra no histórico da requisição e na auditoria; nada é editado nem apagado.

## Migration sugerida

```sql
ALTER TABLE requisicoes_insumo
  ADD COLUMN codigo_retirada  CHAR(6),
  ADD COLUMN codigo_devolucao CHAR(6),
  ADD COLUMN prazo_sobra      DATE;
CREATE UNIQUE INDEX uq_req_codigo_retirada  ON requisicoes_insumo (codigo_retirada)  WHERE codigo_retirada  IS NOT NULL;
CREATE UNIQUE INDEX uq_req_codigo_devolucao ON requisicoes_insumo (codigo_devolucao) WHERE codigo_devolucao IS NOT NULL;
```
