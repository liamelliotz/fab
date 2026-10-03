/**
 * @file pagination.model.ts
 * @description Modelos para paginação e ordenação de listas.
 */

/**
 * Parâmetros enviados na requisição (query params).
 */
export interface ParametrosPaginacao {
  pagina: number;
  itensPorPagina: number;
  ordenarPor?: string;
  direcao?: 'asc' | 'desc';
}

/**
 * Resposta paginada retornada pelo servidor.
 * @template T Tipo do item da lista.
 */
export interface RespostaPaginada<T> {
  itens: T[];
  totalItens: number;
  paginaAtual: number;
  totalPaginas: number;
  itensPorPagina: number;
  temProxima: boolean;
  temAnterior: boolean;
}