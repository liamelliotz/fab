-- =====================================================================================
-- FAB - migration 001: cria todas as tabelas (PostgreSQL 16)
-- Aplicada por `npm run db:migrate`. NUNCA edite este arquivo depois do merge:
-- para mudar o banco, crie 002_<assunto>.sql, 003_... (um arquivo novo por mudança).
--
-- Convenções:
--   - ids são TEXTO (o contrato da API diz "ids sempre texto"); o padrão é um UUID.
--   - nomes em snake_case; o backend converte para camelCase.
--   - datas de calendário: DATE. Momentos: TIMESTAMPTZ.
--   - valores fixos (status, perfil, categoria) usam CHECK, iguais aos enums de src/common/enums.
-- =====================================================================================

-- ---------- usuários ----------
CREATE TABLE usuarios (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome          VARCHAR(120) NOT NULL,
  email         VARCHAR(120) NOT NULL,
  senha_hash    TEXT NOT NULL,
  cpf           CHAR(11) NOT NULL,
  telefone      VARCHAR(11),
  matricula     VARCHAR(30),
  departamento  VARCHAR(80),
  perfil        TEXT NOT NULL DEFAULT 'usuario',
  status        TEXT NOT NULL DEFAULT 'ativo',
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ,
  CONSTRAINT usuarios_perfil_valido CHECK (perfil IN ('admin', 'usuario')),
  CONSTRAINT usuarios_status_valido CHECK (status IN ('ativo', 'inativo', 'bloqueado')),
  CONSTRAINT usuarios_cpf_formato CHECK (cpf ~ '^[0-9]{11}$'),
  CONSTRAINT usuarios_telefone_formato CHECK (telefone IS NULL OR telefone ~ '^[0-9]{10,11}$'),
  CONSTRAINT usuarios_email_minusculo CHECK (email = lower(btrim(email)))
);
CREATE UNIQUE INDEX usuarios_email_unico ON usuarios (email);
CREATE UNIQUE INDEX usuarios_cpf_unico ON usuarios (cpf);
CREATE INDEX usuarios_perfil_status_idx ON usuarios (perfil, status);

-- ---------- equipamentos (itens emprestados e devolvidos) ----------
CREATE TABLE equipamentos (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome                  VARCHAR(120) NOT NULL,
  descricao             TEXT NOT NULL DEFAULT '',
  codigo_patrimonio     VARCHAR(40) NOT NULL,
  categoria             TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'disponivel',
  localizacao           VARCHAR(120) NOT NULL DEFAULT '',
  foto_url              TEXT,
  requer_treinamento    BOOLEAN NOT NULL DEFAULT false,
  prazo_maximo_dias     INTEGER NOT NULL DEFAULT 7,
  quantidade_total      INTEGER NOT NULL,
  quantidade_disponivel INTEGER NOT NULL,
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em         TIMESTAMPTZ,
  CONSTRAINT equipamentos_categoria_valida CHECK (categoria IN ('ferramenta', 'eletronico', 'impressora_3d', 'corte_laser', 'outros')),
  CONSTRAINT equipamentos_status_valido CHECK (status IN ('disponivel', 'emprestado', 'em_manutencao', 'inativo', 'descartado')),
  CONSTRAINT equipamentos_prazo_valido CHECK (prazo_maximo_dias BETWEEN 1 AND 365),
  CONSTRAINT equipamentos_total_valido CHECK (quantidade_total >= 0),
  -- A trava do estoque: o disponível nunca fica negativo nem passa do total.
  CONSTRAINT equipamentos_disponivel_valido CHECK (quantidade_disponivel BETWEEN 0 AND quantidade_total)
);
-- Patrimônio único, ignorando maiúsculas e espaços nas pontas (repetido = 409 na API).
CREATE UNIQUE INDEX equipamentos_patrimonio_unico ON equipamentos (lower(btrim(codigo_patrimonio)));
CREATE INDEX equipamentos_categoria_status_idx ON equipamentos (categoria, status);
CREATE INDEX equipamentos_nome_idx ON equipamentos (lower(nome));

-- Habilitações: quem pode usar cada equipamento que exige treinamento.
CREATE TABLE usuario_habilitacoes (
  usuario_id       TEXT NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  equipamento_id   TEXT NOT NULL REFERENCES equipamentos (id) ON DELETE CASCADE,
  concedida_por_id TEXT REFERENCES usuarios (id) ON DELETE SET NULL,
  concedida_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, equipamento_id)
);
CREATE INDEX usuario_habilitacoes_equipamento_idx ON usuario_habilitacoes (equipamento_id);

-- ---------- empréstimos ----------
-- Contador do protocolo EMP-AAAA-0001 (uma linha por ano). O backend usa
--   INSERT ... ON CONFLICT (ano) DO UPDATE SET ultimo = sequencias_protocolo.ultimo + 1 RETURNING ultimo
-- que é atômico: dois pedidos simultâneos nunca recebem o mesmo número.
CREATE TABLE sequencias_protocolo (
  ano    INTEGER PRIMARY KEY,
  ultimo INTEGER NOT NULL DEFAULT 0 CHECK (ultimo >= 0)
);

CREATE TABLE emprestimos (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  protocolo               VARCHAR(20) NOT NULL,
  solicitante_id          TEXT NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
  responsavel_id          TEXT NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
  justificativa           TEXT NOT NULL,
  -- 'atrasado' NÃO entra aqui: é calculado na leitura pela data prevista de devolução.
  status                  TEXT NOT NULL DEFAULT 'pendente',
  data_solicitacao        TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_prevista_retirada  DATE NOT NULL,
  data_prevista_devolucao DATE NOT NULL,
  data_retirada_efetiva   DATE,
  data_devolucao_efetiva  DATE,
  avaliado_por_id         TEXT REFERENCES usuarios (id) ON DELETE RESTRICT,
  motivo_rejeicao         TEXT,
  codigo_retirada         CHAR(6),
  codigo_devolucao        CHAR(6),
  houve_avaria            BOOLEAN,
  observacoes_devolucao   TEXT,
  atualizado_em           TIMESTAMPTZ,
  CONSTRAINT emprestimos_protocolo_formato CHECK (protocolo ~ '^EMP-[0-9]{4}-[0-9]{4,}$'),
  CONSTRAINT emprestimos_status_valido CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'em_andamento', 'devolvido', 'cancelado')),
  CONSTRAINT emprestimos_datas_validas CHECK (data_prevista_devolucao >= data_prevista_retirada),
  CONSTRAINT emprestimos_rejeicao_com_motivo CHECK (status <> 'rejeitado' OR length(btrim(coalesce(motivo_rejeicao, ''))) > 0),
  CONSTRAINT emprestimos_justificativa_preenchida CHECK (length(btrim(justificativa)) > 0)
);
CREATE UNIQUE INDEX emprestimos_protocolo_unico ON emprestimos (protocolo);
-- Um código só vale para um pedido por vez.
CREATE UNIQUE INDEX emprestimos_codigo_retirada_unico ON emprestimos (codigo_retirada) WHERE codigo_retirada IS NOT NULL;
CREATE UNIQUE INDEX emprestimos_codigo_devolucao_unico ON emprestimos (codigo_devolucao) WHERE codigo_devolucao IS NOT NULL;
CREATE INDEX emprestimos_status_idx ON emprestimos (status);
CREATE INDEX emprestimos_solicitante_idx ON emprestimos (solicitante_id, data_solicitacao DESC);
CREATE INDEX emprestimos_responsavel_idx ON emprestimos (responsavel_id);
-- Acelera a consulta de atrasados (dashboard e tarefa diária).
CREATE INDEX emprestimos_ativos_por_prazo_idx ON emprestimos (data_prevista_devolucao) WHERE status IN ('aprovado', 'em_andamento');

CREATE TABLE emprestimo_itens (
  emprestimo_id  TEXT NOT NULL REFERENCES emprestimos (id) ON DELETE CASCADE,
  equipamento_id TEXT NOT NULL REFERENCES equipamentos (id) ON DELETE RESTRICT,
  quantidade     INTEGER NOT NULL CHECK (quantidade > 0),
  observacoes    TEXT,
  PRIMARY KEY (emprestimo_id, equipamento_id)
);
CREATE INDEX emprestimo_itens_equipamento_idx ON emprestimo_itens (equipamento_id);

-- Linha do tempo (auditoria). Só acréscimo: veja o gatilho no fim do arquivo.
CREATE TABLE emprestimo_eventos (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  emprestimo_id TEXT NOT NULL REFERENCES emprestimos (id) ON DELETE RESTRICT,
  tipo          TEXT NOT NULL,
  em            TIMESTAMPTZ NOT NULL DEFAULT now(),
  por_id        TEXT NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
  detalhe       TEXT,
  CONSTRAINT emprestimo_eventos_tipo_valido CHECK (tipo IN (
    'solicitado', 'aprovado', 'rejeitado', 'cancelado', 'retirado',
    'transferencia_solicitada', 'transferencia_aceita', 'transferencia_recusada', 'transferencia_cancelada',
    'devolvido'))
);
CREATE INDEX emprestimo_eventos_linha_do_tempo_idx ON emprestimo_eventos (emprestimo_id, em);

-- Transferências entre professores (a pendente e o histórico das respondidas).
CREATE TABLE emprestimo_transferencias (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  emprestimo_id TEXT NOT NULL REFERENCES emprestimos (id) ON DELETE RESTRICT,
  de_id         TEXT NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
  para_id       TEXT NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
  motivo        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pendente',
  motivo_recusa TEXT,
  solicitada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  respondida_em TIMESTAMPTZ,
  CONSTRAINT emprestimo_transferencias_status_valido CHECK (status IN ('pendente', 'aceita', 'recusada', 'cancelada')),
  CONSTRAINT emprestimo_transferencias_pessoas_diferentes CHECK (de_id <> para_id)
);
-- No máximo UMA transferência pendente por pedido.
CREATE UNIQUE INDEX emprestimo_transferencias_uma_pendente ON emprestimo_transferencias (emprestimo_id) WHERE status = 'pendente';
CREATE INDEX emprestimo_transferencias_para_idx ON emprestimo_transferencias (para_id) WHERE status = 'pendente';

-- ---------- manutenções ----------
CREATE TABLE manutencoes (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  equipamento_id    TEXT NOT NULL REFERENCES equipamentos (id) ON DELETE RESTRICT,
  emprestimo_id     TEXT REFERENCES emprestimos (id) ON DELETE SET NULL,
  descricao         TEXT NOT NULL,
  assistencia       VARCHAR(120),
  -- Quantas unidades saíram do estoque disponível por causa desta manutenção.
  quantidade        INTEGER NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  status            TEXT NOT NULL DEFAULT 'avariado',
  data_registro     DATE NOT NULL DEFAULT CURRENT_DATE,
  data_conclusao    DATE,
  registrado_por_id TEXT REFERENCES usuarios (id) ON DELETE SET NULL,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT manutencoes_status_valido CHECK (status IN ('avariado', 'em_assistencia', 'concluido')),
  CONSTRAINT manutencoes_conclusao_coerente CHECK ((status = 'concluido') = (data_conclusao IS NOT NULL))
);
CREATE INDEX manutencoes_equipamento_idx ON manutencoes (equipamento_id);
CREATE INDEX manutencoes_abertas_idx ON manutencoes (status) WHERE status <> 'concluido';

-- ---------- recuperação de senha ----------
-- Guarda só o HASH do token (como uma senha). Uso único e validade curta.
CREATE TABLE tokens_redefinicao_senha (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  usuario_id TEXT NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expira_em  TIMESTAMPTZ NOT NULL,
  usado_em   TIMESTAMPTZ,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tokens_redefinicao_usuario_idx ON tokens_redefinicao_senha (usuario_id);

-- ---------- insumos (itens de consumo) ----------
CREATE TABLE insumos (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome             VARCHAR(120) NOT NULL,
  descricao        TEXT,
  categoria        TEXT NOT NULL,
  unidade_medida   TEXT NOT NULL,
  -- NUMERIC (e não float): 0,1 + 0,2 dá exatamente 0,3. Até 3 casas decimais.
  quantidade_atual NUMERIC(12, 3) NOT NULL DEFAULT 0,
  estoque_minimo   NUMERIC(12, 3) NOT NULL DEFAULT 0,
  fornecedor       VARCHAR(120),
  validade         DATE,
  localizacao      VARCHAR(120),
  ativo            BOOLEAN NOT NULL DEFAULT true,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em    TIMESTAMPTZ,
  CONSTRAINT insumos_categoria_valida CHECK (categoria IN ('impressao_3d', 'eletronica', 'papelaria', 'limpeza', 'ferragens', 'outros')),
  CONSTRAINT insumos_unidade_valida CHECK (unidade_medida IN ('un', 'cx', 'pct', 'rolo', 'kg', 'g', 'l', 'ml', 'm')),
  -- A trava principal do módulo: o saldo NUNCA fica negativo, nem por erro do backend.
  CONSTRAINT insumos_saldo_nao_negativo CHECK (quantidade_atual >= 0),
  CONSTRAINT insumos_minimo_nao_negativo CHECK (estoque_minimo >= 0)
);
CREATE UNIQUE INDEX insumos_nome_unico ON insumos (lower(btrim(nome)));
CREATE INDEX insumos_categoria_idx ON insumos (categoria) WHERE ativo;
-- Lista "a repor": só os ativos que atingiram o mínimo.
CREATE INDEX insumos_a_repor_idx ON insumos (nome) WHERE ativo AND quantidade_atual <= estoque_minimo;

-- Movimentações de estoque. Só acréscimo: veja o gatilho no fim do arquivo.
CREATE TABLE movimentacoes_insumo (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  insumo_id       TEXT NOT NULL REFERENCES insumos (id) ON DELETE RESTRICT,
  tipo            TEXT NOT NULL,
  quantidade      NUMERIC(12, 3) NOT NULL,
  saldo_apos      NUMERIC(12, 3) NOT NULL,
  motivo          TEXT NOT NULL,
  observacao      TEXT,
  responsavel_id  TEXT NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
  destinatario_id TEXT REFERENCES usuarios (id) ON DELETE RESTRICT,
  validade_lote   DATE,
  ocorrida_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT movimentacoes_tipo_valido CHECK (tipo IN ('entrada', 'saida')),
  CONSTRAINT movimentacoes_quantidade_positiva CHECK (quantidade > 0),
  CONSTRAINT movimentacoes_saldo_nao_negativo CHECK (saldo_apos >= 0),
  CONSTRAINT movimentacoes_motivo_do_tipo CHECK (
    (tipo = 'entrada' AND motivo IN ('compra', 'doacao', 'ajuste_positivo')) OR
    (tipo = 'saida' AND motivo IN ('uso_em_aula', 'perda', 'vencimento', 'ajuste_negativo'))),
  CONSTRAINT movimentacoes_destinatario_so_na_saida CHECK (destinatario_id IS NULL OR tipo = 'saida'),
  CONSTRAINT movimentacoes_validade_so_na_entrada CHECK (validade_lote IS NULL OR tipo = 'entrada')
);
-- Histórico por item e por período (filtros e relatório de consumo).
CREATE INDEX movimentacoes_insumo_data_idx ON movimentacoes_insumo (insumo_id, ocorrida_em DESC);
CREATE INDEX movimentacoes_data_idx ON movimentacoes_insumo (ocorrida_em DESC);
CREATE INDEX movimentacoes_tipo_data_idx ON movimentacoes_insumo (tipo, ocorrida_em DESC);

-- ---------- auditoria: tabelas de "só acréscimo" ----------
-- Eventos de empréstimo e movimentações de insumo nunca são alterados nem apagados.
CREATE FUNCTION fab_impedir_alteracao() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'A tabela % é somente de acréscimo: não aceita % (registre um novo lançamento).', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER emprestimo_eventos_so_acrescimo
  BEFORE UPDATE OR DELETE ON emprestimo_eventos
  FOR EACH ROW EXECUTE FUNCTION fab_impedir_alteracao();

CREATE TRIGGER movimentacoes_insumo_so_acrescimo
  BEFORE UPDATE OR DELETE ON movimentacoes_insumo
  FOR EACH ROW EXECUTE FUNCTION fab_impedir_alteracao();
