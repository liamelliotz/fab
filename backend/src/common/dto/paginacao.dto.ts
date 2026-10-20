import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const PAGINA_PADRAO = 1;
export const ITENS_POR_PAGINA_PADRAO = 10;
export const ITENS_POR_PAGINA_MAXIMO = 100;

/**
 * Parâmetros de paginação da query string (?pagina=2&itensPorPagina=20).
 *
 * Como usar: todo DTO de filtro de uma listagem estende esta classe.
 *
 *   export class FiltroEmprestimoDto extends PaginacaoDto {
 *     @IsOptional() @IsEnum(StatusEmprestimo) status?: StatusEmprestimo;
 *   }
 */
export class PaginacaoDto {
  @ApiPropertyOptional({
    description: 'Número da página (começa em 1).',
    default: PAGINA_PADRAO,
    minimum: 1,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'pagina deve ser um número inteiro.' })
  @Min(1, { message: 'pagina deve ser no mínimo 1.' })
  pagina: number = PAGINA_PADRAO;

  @ApiPropertyOptional({
    description: 'Quantidade de itens por página.',
    default: ITENS_POR_PAGINA_PADRAO,
    minimum: 1,
    maximum: ITENS_POR_PAGINA_MAXIMO,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'itensPorPagina deve ser um número inteiro.' })
  @Min(1, { message: 'itensPorPagina deve ser no mínimo 1.' })
  @Max(ITENS_POR_PAGINA_MAXIMO, {
    message: `itensPorPagina deve ser no máximo ${ITENS_POR_PAGINA_MAXIMO}.`,
  })
  itensPorPagina: number = ITENS_POR_PAGINA_PADRAO;
}

/** Formato do `dados` de toda listagem. Igual ao RespostaPaginada do front. */
export interface RespostaPaginada<T> {
  itens: T[];
  totalItens: number;
  paginaAtual: number;
  totalPaginas: number;
  itensPorPagina: number;
  temProxima: boolean;
  temAnterior: boolean;
}

type ParametrosDePagina = Pick<PaginacaoDto, 'pagina' | 'itensPorPagina'>;

/**
 * Pagina uma lista que já está inteira na memória (o caso dos repositórios em memória).
 * Filtre e ordene ANTES e passe a lista completa: esta função só recorta a página.
 *
 *   return montarPagina(equipamentosFiltrados, filtro);
 */
export function montarPagina<T>(
  lista: readonly T[],
  paginacao: ParametrosDePagina,
): RespostaPaginada<T> {
  const { pagina, itensPorPagina } = normalizar(paginacao);
  const inicio = (pagina - 1) * itensPorPagina;
  return montarPaginaComTotal(
    lista.slice(inicio, inicio + itensPorPagina),
    lista.length,
    paginacao,
  );
}

/**
 * Monta a resposta quando os itens da página JÁ foram recortados e o total é conhecido
 * (o caso do banco de dados, com skip/take). Será o uso quando entrar o PostgreSQL.
 */
export function montarPaginaComTotal<T>(
  itensDaPagina: T[],
  totalItens: number,
  paginacao: ParametrosDePagina,
): RespostaPaginada<T> {
  const { pagina, itensPorPagina } = normalizar(paginacao);
  const totalPaginas = Math.ceil(totalItens / itensPorPagina);
  return {
    itens: itensDaPagina,
    totalItens,
    paginaAtual: pagina,
    totalPaginas,
    itensPorPagina,
    temProxima: pagina < totalPaginas,
    temAnterior: pagina > 1,
  };
}

// Defesa extra: se alguém chamar a função sem passar pelo DTO, nada de página 0 ou tamanho 0.
function normalizar({ pagina, itensPorPagina }: ParametrosDePagina) {
  return {
    pagina: Math.max(1, Math.trunc(pagina) || PAGINA_PADRAO),
    itensPorPagina: Math.min(
      ITENS_POR_PAGINA_MAXIMO,
      Math.max(1, Math.trunc(itensPorPagina) || ITENS_POR_PAGINA_PADRAO),
    ),
  };
}
