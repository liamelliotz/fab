/**
 * Envelope de TODA resposta da API (sucesso ou erro). Igual ao ApiResponse do front
 * (core/models/api-response.model.ts).
 *
 * Quem monta o envelope é o ResponseInterceptor (sucesso) e o HttpExceptionFilter (erro).
 * Os controllers devolvem só o dado, sem montar o envelope.
 */
export interface RespostaApi<T = unknown> {
  sucesso: boolean;
  /** Resumo em texto. Em erro, sempre vem preenchido. */
  mensagem?: string;
  /** Conteúdo da resposta. `null` quando não há dado (ou em erro). */
  dados: T | null;
  /** Lista de mensagens detalhadas (ex.: campos inválidos). Vazia quando não há. */
  erros: string[];
  /** Momento da resposta, em ISO 8601. */
  timestamp: string;
}
