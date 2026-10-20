import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HttpExceptionFilter } from './filters/http-exception.filter.js';
import { ResponseInterceptor } from './interceptors/response.interceptor.js';

/**
 * Liga o padrão de resposta da API: envelope de sucesso (ResponseInterceptor) e
 * envelope de erro (HttpExceptionFilter).
 *
 * É chamado pelo main.ts. Os testes e2e também devem chamar esta função logo depois de
 * criar o app (depois de `createNestApplication()` e antes de `init()`), para que as
 * respostas dos testes venham no mesmo formato da API real.
 */
export function aplicarPadraoDeResposta(app: INestApplication): void {
  app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new HttpExceptionFilter());
}
