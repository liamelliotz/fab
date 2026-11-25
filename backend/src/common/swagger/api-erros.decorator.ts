import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { MENSAGEM_PADRAO } from '../filters/http-exception.filter.js';

/** Códigos de erro que as rotas documentam no Swagger (os mesmos da coluna "Erros" do contrato). */
export type CodigoDeErro = 400 | 401 | 403 | 404 | 409 | 429;

/** Exemplo de `erros` no 400: é o que o ValidationPipe devolve quando um campo vem errado. */
const EXEMPLO_ERROS_400 = ['Informe um e-mail válido.'];

/** Corpo de exemplo de um erro, no mesmo envelope que o HttpExceptionFilter monta. */
export function exemploDeErro(codigo: CodigoDeErro) {
  return {
    sucesso: false,
    mensagem: codigo === 400 ? 'Dados inválidos.' : MENSAGEM_PADRAO[codigo],
    dados: null,
    erros: codigo === 400 ? EXEMPLO_ERROS_400 : [],
    timestamp: '2026-11-25T12:00:00.000Z',
  };
}

/**
 * Documenta no Swagger as respostas de erro de uma rota, com o envelope de exemplo.
 *
 * Uso: `@ApiErros(400, 404, 409)` logo abaixo do `@ApiOperation`.
 * A mensagem real de cada erro vem de quem o lança; o exemplo mostra o formato.
 */
export function ApiErros(...codigos: CodigoDeErro[]) {
  return applyDecorators(
    ...codigos.map((codigo) =>
      ApiResponse({
        status: codigo,
        description: MENSAGEM_PADRAO[codigo],
        content: { 'application/json': { example: exemploDeErro(codigo) } },
      }),
    ),
  );
}
