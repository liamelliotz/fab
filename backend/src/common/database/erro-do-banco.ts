import { ConflictException, type HttpException } from '@nestjs/common';

/**
 * Mensagem em português para cada restrição das migrations (nome do índice ou do CHECK).
 * Quem levar um módulo para o banco e criar uma restrição nova acrescenta a linha aqui.
 * Restrição fora da lista: usa a mensagem padrão do tipo de erro.
 */
export const MENSAGENS_DAS_RESTRICOES: Readonly<Record<string, string>> = {
  // usuários
  usuarios_pkey: 'Já existe um usuário com este id.',
  usuarios_email_unico: 'Já existe um usuário com este e-mail.',
  usuarios_cpf_unico: 'Já existe um usuário com este CPF.',
  usuarios_cpf_formato: 'O CPF precisa ter 11 dígitos.',
  usuarios_telefone_formato:
    'O telefone precisa ter 10 ou 11 dígitos (com DDD).',
  usuarios_perfil_valido: 'Perfil inválido. Use "admin" ou "usuario".',
  usuarios_status_valido:
    'Status inválido. Use "ativo", "inativo" ou "bloqueado".',
  usuario_habilitacoes_equipamento_id_fkey:
    'Habilitação para um equipamento que não existe.',
  // equipamentos
  equipamentos_patrimonio_unico:
    'Já existe um equipamento com este código de patrimônio.',
  equipamentos_disponivel_valido:
    'A quantidade disponível precisa ficar entre 0 e a quantidade total.',
  // empréstimos
  emprestimos_protocolo_unico: 'Já existe um empréstimo com este protocolo.',
  emprestimos_datas_validas:
    'A devolução prevista não pode ser antes da retirada prevista.',
  emprestimo_transferencias_uma_pendente:
    'Este empréstimo já tem uma transferência pendente.',
  // insumos
  insumos_nome_unico: 'Já existe um insumo com este nome.',
  insumos_saldo_nao_negativo: 'Estoque insuficiente para esta saída.',
  movimentacoes_saldo_nao_negativo: 'Estoque insuficiente para esta saída.',
};

interface ErroDoPostgres {
  code?: string;
  constraint?: string;
  detail?: string;
}

/** Lê o erro do driver `pg`, venha ele cru ou embrulhado pelo TypeORM (QueryFailedError). */
function lerErroDoPostgres(erro: unknown): ErroDoPostgres | null {
  if (typeof erro !== 'object' || erro === null) return null;
  const { driverError } = erro as { driverError?: unknown };
  const fonte = (
    typeof driverError === 'object' && driverError !== null ? driverError : erro
  ) as ErroDoPostgres;
  return typeof fonte.code === 'string' ? fonte : null;
}

/**
 * Traduz as violações de regra do PostgreSQL para 409 com mensagem em português.
 * Devolve `null` para qualquer outro erro (ele segue como 500).
 *
 * - 23505 (valor repetido em índice único): "Já existe..."
 * - 23503 (chave estrangeira): registro em uso, ou apontando para um que não existe
 * - 23514 (CHECK): a regra da tabela que foi quebrada
 *
 * Já é chamada pelo filtro global de erros: os repositórios NÃO precisam tratar nada.
 */
export function erroDoBancoParaHttp(erro: unknown): HttpException | null {
  const pg = lerErroDoPostgres(erro);
  if (!pg || !['23505', '23503', '23514'].includes(pg.code ?? '')) return null;

  const especifica = pg.constraint
    ? MENSAGENS_DAS_RESTRICOES[pg.constraint]
    : undefined;
  if (especifica) return new ConflictException(especifica);

  if (pg.code === '23505') {
    return new ConflictException('Já existe um registro com estes dados.');
  }
  if (pg.code === '23503') {
    return new ConflictException(
      pg.detail?.includes('is still referenced')
        ? 'O registro está em uso por outros dados e não pode ser removido.'
        : 'Os dados apontam para um registro que não existe.',
    );
  }
  return new ConflictException('Os dados não respeitam uma regra do cadastro.');
}
