# Contrato: regras de empréstimo

Regras configuráveis pela coordenação e aplicadas a todo pedido. Na demonstração elas já funcionam
no navegador (`RegrasEmprestimoService` e `EmprestimoService`); este documento é o que a API precisa
fazer para valerem também com o backend. **Toda regra abaixo deve ser conferida no servidor**: o
frontend só mostra os avisos.

## Configuração

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| `GET` | `/regras-emprestimo` | todos | Devolve as regras em vigor |
| `PUT` | `/regras-emprestimo` | admin | Troca as regras e grava uma linha de auditoria com o que mudou |

```json
{
  "diasParaRetirar": 1,
  "limitePorCategoria": { "eletronico": 4, "ferramenta": 3, "impressora_3d": 1, "corte_laser": 1, "outros": null },
  "politicaAtraso": "suspensao",
  "fatorSuspensao": 2,
  "maximoSuspensaoDias": 30
}
```

| Campo | Regra |
| --- | --- |
| `diasParaRetirar` | inteiro de 0 a 7. 0 = só no próprio dia da retirada prevista |
| `limitePorCategoria` | inteiro de 1 a 50 por categoria, ou `null` (sem limite) |
| `politicaAtraso` | `aviso` · `bloqueio` · `suspensao` |
| `fatorSuspensao` | inteiro de 1 a 5 (dias de suspensão por dia de atraso) |
| `maximoSuspensaoDias` | inteiro de 1 a 90 |

## 1. Pedido aprovado e não retirado expira

- Prazo para retirar = `dataPrevistaRetirada + diasParaRetirar` (inclusive).
- Um job (a cada hora, por exemplo) muda para `cancelado` todo pedido `aprovado` cujo prazo passou:
  libera a reserva no estoque, apaga o `codigoRetirada`, grava `motivoCancelamento`
  ("Expirou: não foi retirado até dd/mm/aaaa...") e o evento `expirado` assinado pelo sistema.
- `POST /emprestimos/retirada` com o código de um pedido vencido responde **409** e expira o pedido na hora.

## 2. Limite por categoria

- Conta as unidades dos pedidos `pendente`, `aprovado` e `em_andamento` em que a pessoa é a **responsável**.
- `POST /emprestimos` responde **422** se a soma com os itens novos passar do limite de alguma categoria.
- Transferência: o destinatário também não pode passar do limite (**422**).

## 3. Política de atraso e suspensão automática

| Política | Com material atrasado | Ao devolver com atraso |
| --- | --- | --- |
| `aviso` | pode pedir | nada |
| `bloqueio` | `POST /emprestimos` → **403** | nada |
| `suspensao` | `POST /emprestimos` → **403** | suspende por `min(maximo, diasAtraso × fator)` dias |

- Suspensão: grava em `usuarios` os campos `suspensao_ate` (DATE, inclusive) e `motivo_suspensao`,
  e o evento `suspensao_aplicada` no pedido. Ela termina sozinha: basta comparar a data.
- Pessoa suspensa: não faz pedidos (**403**), não tem pedido pendente aprovado (`PATCH .../avaliar` → **409**)
  e não recebe transferências.
- Uma suspensão nova nunca encurta outra que já termina depois.
- `DELETE /usuarios/:id/suspensao` (admin) encerra a suspensão antes do prazo e grava auditoria.

## Migration sugerida

```sql
CREATE TABLE regras_emprestimo (
  id                    SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- uma linha só
  dias_para_retirar     SMALLINT NOT NULL DEFAULT 1 CHECK (dias_para_retirar BETWEEN 0 AND 7),
  limite_por_categoria  JSONB    NOT NULL,
  politica_atraso       TEXT     NOT NULL CHECK (politica_atraso IN ('aviso','bloqueio','suspensao')),
  fator_suspensao       SMALLINT NOT NULL CHECK (fator_suspensao BETWEEN 1 AND 5),
  maximo_suspensao_dias SMALLINT NOT NULL CHECK (maximo_suspensao_dias BETWEEN 1 AND 90),
  atualizado_em         TIMESTAMPTZ,
  atualizado_por        UUID REFERENCES usuarios(id)
);
ALTER TABLE usuarios ADD COLUMN suspensao_ate DATE, ADD COLUMN motivo_suspensao TEXT;
```
