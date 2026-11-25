/**
 * Token de "esqueci minha senha". Guardamos só o HASH (SHA-256) do token: quem ler o banco
 * não consegue usar o link. O token em texto existe só no link enviado ao usuário.
 */
export interface TokenRedefinicao {
  id: string;
  usuarioId: string;
  /** SHA-256 do token, em hexadecimal (64 caracteres). */
  tokenHash: string;
  /** ISO 8601. Depois disso o link não vale mais. */
  expiraEm: string;
  /** Preenchido quando o link é usado (uso único). */
  usadoEm?: string;
  criadoEm: string;
}
