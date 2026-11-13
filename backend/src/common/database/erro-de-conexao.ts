/**
 * Traduz o erro do driver do PostgreSQL (pg) para uma frase em português.
 *
 * O Node às vezes devolve um AggregateError com a mensagem VAZIA (ex.: quando tenta IPv4 e
 * IPv6 e os dois recusam). Por isso olhamos também o `code` e os erros internos.
 */
const CODIGOS: Record<string, string> = {
  ECONNREFUSED: 'conexão recusada: não há banco ouvindo nesse endereço e porta',
  ENOTFOUND:
    'endereço do banco não encontrado (confira o host na DATABASE_URL)',
  EAI_AGAIN:
    'não foi possível resolver o endereço do banco (sem internet ou DNS)',
  ETIMEDOUT: 'o banco não respondeu a tempo',
  ECONNRESET: 'a conexão foi encerrada pelo banco',
  '28P01': 'usuário ou senha incorretos',
  '28000': 'acesso negado para este usuário',
  '3D000': 'o banco de dados informado não existe',
  '42P01': 'tabela não encontrada (rode npm run db:migrate)',
};

interface ErroComCodigo {
  code?: string;
  message?: string;
  errors?: unknown[];
}

function codigoDo(erro: unknown): string | undefined {
  const e = erro as ErroComCodigo | undefined;
  if (e?.code) return e.code;
  const interno = e?.errors?.find((x) => (x as ErroComCodigo)?.code);
  return (interno as ErroComCodigo | undefined)?.code;
}

/** Frase curta sobre a causa, sempre preenchida. */
export function descreverErroDeConexao(erro: unknown): string {
  const codigo = codigoDo(erro);
  if (codigo && CODIGOS[codigo]) {
    return `${CODIGOS[codigo]} [${codigo}]`;
  }
  const mensagem = (erro as ErroComCodigo | undefined)?.message?.trim();
  if (mensagem) {
    return codigo ? `${mensagem} [${codigo}]` : mensagem;
  }
  return codigo ? `erro ${codigo}` : 'erro desconhecido';
}

/** Mensagem completa, com o que fazer. Usada pela API e pelos scripts db:*. */
export function mensagemDeFalhaDeConexao(erro: unknown): string {
  return (
    `Não foi possível conectar ao PostgreSQL: ${descreverErroDeConexao(erro)}. ` +
    'Confira se o banco está no ar (na raiz do projeto: docker compose up -d) e a DATABASE_URL do backend/.env. ' +
    'Para trabalhar sem banco, use PERSISTENCIA=memoria.'
  );
}

/** Mostra a DATABASE_URL sem a senha, para o log. */
export function urlSemSenha(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    return `${u.protocol}//${u.username ? `${u.username}@` : ''}${u.host}${u.pathname}`;
  } catch {
    return '(DATABASE_URL inválida)';
  }
}
