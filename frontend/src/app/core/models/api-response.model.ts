/**
 * @file api-response.model.ts
 * @description Envelope genérico padrão para respostas da API REST.
 */

/**
 * Resposta genérica envelopada da API.
 * @template T Tipo do payload contido na propriedade `dados`.
 */
export interface ApiResponse<T> {
  sucesso: boolean;
  mensagem?: string;
  dados: T;
  erros?: string[];
  timestamp: string;
}