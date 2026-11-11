# FAB — Banco de dados (PostgreSQL 16)

O banco é criado por arquivos SQL em `backend/database/migrations/`, aplicados por `npm run db:migrate`.
O arquivo `001_criar_tabelas.sql` é a fonte da verdade: este documento só o explica.

## 1. Como subir

```bash
docker compose up -d            # na raiz do projeto: sobe o PostgreSQL 16 na porta 5432
cd backend
cp .env.example .env            # já traz o DATABASE_URL do docker-compose
npm run db:migrate              # cria as tabelas
npm run db:seed                 # APAGA os dados e grava os de exemplo
```

`npm run db:reset` faz os dois últimos de uma vez. Sem Docker, qualquer PostgreSQL 13 ou mais novo serve
(instalado na máquina ou hospedado): troque o `DATABASE_URL` no `.env`.

## 2. Diagrama ER

```mermaid
erDiagram
  usuarios ||--o{ usuario_habilitacoes : "tem"
  equipamentos ||--o{ usuario_habilitacoes : "exige"
  usuarios ||--o{ emprestimos : "solicita / responde por"
  emprestimos ||--|{ emprestimo_itens : "contém"
  equipamentos ||--o{ emprestimo_itens : "é pedido em"
  emprestimos ||--|{ emprestimo_eventos : "linha do tempo"
  usuarios ||--o{ emprestimo_eventos : "executa"
  emprestimos ||--o{ emprestimo_transferencias : "é transferido"
  usuarios ||--o{ emprestimo_transferencias : "de / para"
  equipamentos ||--o{ manutencoes : "vai para"
  emprestimos |o--o{ manutencoes : "origina"
  usuarios ||--o{ tokens_redefinicao_senha : "pede"
  insumos ||--o{ movimentacoes_insumo : "entra / sai"
  usuarios ||--o{ movimentacoes_insumo : "registra / recebe"

  usuarios {
    text id PK
    varchar nome
    varchar email UK
    text senha_hash
    char cpf UK
    varchar telefone
    varchar matricula
    varchar departamento
    text perfil "admin | usuario"
    text status "ativo | inativo | bloqueado"
    timestamptz criado_em
    timestamptz atualizado_em
  }
  equipamentos {
    text id PK
    varchar nome
    text descricao
    varchar codigo_patrimonio UK
    text categoria
    text status
    varchar localizacao
    text foto_url
    boolean requer_treinamento
    int prazo_maximo_dias "1 a 365"
    int quantidade_total
    int quantidade_disponivel "0 a total"
    timestamptz criado_em
    timestamptz atualizado_em
  }
  usuario_habilitacoes {
    text usuario_id PK, FK
    text equipamento_id PK, FK
    text concedida_por_id FK
    timestamptz concedida_em
  }
  emprestimos {
    text id PK
    varchar protocolo UK "EMP-AAAA-0001"
    text solicitante_id FK
    text responsavel_id FK
    text justificativa
    text status "sem atrasado"
    timestamptz data_solicitacao
    date data_prevista_retirada
    date data_prevista_devolucao
    date data_retirada_efetiva
    date data_devolucao_efetiva
    text avaliado_por_id FK
    text motivo_rejeicao
    char codigo_retirada UK
    char codigo_devolucao UK
    boolean houve_avaria
    text observacoes_devolucao
  }
  emprestimo_itens {
    text emprestimo_id PK, FK
    text equipamento_id PK, FK
    int quantidade "maior que 0"
    text observacoes
  }
  emprestimo_eventos {
    text id PK
    text emprestimo_id FK
    text tipo
    timestamptz em
    text por_id FK
    text detalhe
  }
  emprestimo_transferencias {
    text id PK
    text emprestimo_id FK
    text de_id FK
    text para_id FK
    text motivo
    text status "pendente | aceita | recusada | cancelada"
    text motivo_recusa
    timestamptz solicitada_em
    timestamptz respondida_em
  }
  manutencoes {
    text id PK
    text equipamento_id FK
    text emprestimo_id FK
    text descricao
    varchar assistencia
    int quantidade
    text status "avariado | em_assistencia | concluido"
    date data_registro
    date data_conclusao
    text registrado_por_id FK
  }
  tokens_redefinicao_senha {
    text id PK
    text usuario_id FK
    text token_hash UK
    timestamptz expira_em
    timestamptz usado_em
  }
  sequencias_protocolo {
    int ano PK
    int ultimo
  }
  insumos {
    text id PK
    varchar nome UK
    text descricao
    text categoria
    text unidade_medida
    numeric quantidade_atual "nunca negativa"
    numeric estoque_minimo
    varchar fornecedor
    date validade
    varchar localizacao
    boolean ativo
    timestamptz criado_em
    timestamptz atualizado_em
  }
  movimentacoes_insumo {
    text id PK
    text insumo_id FK
    text tipo "entrada | saida"
    numeric quantidade "maior que 0"
    numeric saldo_apos "nunca negativo"
    text motivo
    text observacao
    text responsavel_id FK
    text destinatario_id FK
    date validade_lote
    timestamptz ocorrida_em
    timestamptz criado_em
  }
```

## 3. Travas que o próprio banco garante

Estas regras valem mesmo que o backend tenha um bug. Todas foram testadas no PostgreSQL 16.

| Regra | Como o banco garante |
| --- | --- |
| Saldo de insumo nunca negativo | `CHECK (quantidade_atual >= 0)` em `insumos` e `CHECK (saldo_apos >= 0)` nas movimentações |
| Estoque de equipamento entre 0 e o total | `CHECK (quantidade_disponivel BETWEEN 0 AND quantidade_total)` |
| Patrimônio, e-mail, CPF e nome de insumo únicos | índices únicos (patrimônio e nome ignoram maiúsculas e espaços) |
| Protocolo nunca repete | índice único e contador atômico em `sequencias_protocolo` |
| Um código de retirada ou devolução vale para um pedido só | índices únicos parciais |
| Uma transferência pendente por pedido | índice único parcial `WHERE status = 'pendente'` |
| Reprovação exige motivo | `CHECK` em `emprestimos` |
| Linha do tempo e movimentações são só de acréscimo | gatilho `fab_impedir_alteracao` recusa `UPDATE` e `DELETE` |
| Motivo combina com o tipo da movimentação | `CHECK movimentacoes_motivo_do_tipo` |

## 4. Como o backend usa (decisão)

- **ORM: TypeORM 0.3 com `@nestjs/typeorm`**, só como mapeador. `synchronize: false` sempre: quem cria e altera
  tabelas são os arquivos `.sql`. O plano original citava Prisma, mas hoje ele está em transição entre a
  versão 7 e uma 8 ainda em teste, com comandos diferentes; o TypeORM é a integração oficial do NestJS e é estável.
- Cada módulo troca o **seu** repositório em memória por um repositório TypeORM com os **mesmos métodos**
  (`criar`, `buscarPorId`, `listar`, `atualizar`, `remover` e as consultas do módulo). Os services não mudam.
- Operações que mexem em mais de uma tabela (aprovar pedido, devolução, movimentação de insumo) rodam em
  **transação**. Para mudar saldo, use `UPDATE ... SET quantidade = quantidade - $1 WHERE id = $2 AND quantidade >= $1`
  e confira se 1 linha foi alterada: assim dois pedidos simultâneos não levam o mesmo item.
- Os testes unitários continuam com os repositórios em memória (não precisam de banco).

## 5. Mudar o banco depois

Nunca edite um `.sql` que já foi para a `main`. Crie o próximo número (`002_<assunto>.sql`), teste com
`npm run db:reset` e avise no card. Só a **Pessoa A** cria migrations, para dois arquivos nunca terem o mesmo número.
