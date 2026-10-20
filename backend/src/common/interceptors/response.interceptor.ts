import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, type Observable } from 'rxjs';
import type { RespostaApi } from '../dto/resposta-api.dto.js';
import { MENSAGEM_RESPOSTA } from './mensagem-resposta.decorator.js';

/**
 * Coloca TODA resposta de sucesso dentro do envelope { sucesso, mensagem, dados, erros, timestamp }.
 * Os controllers devolvem só o dado; este interceptor cuida do resto.
 */
@Injectable()
export class ResponseInterceptor<T = unknown> implements NestInterceptor<
  T,
  RespostaApi<T> | T
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<RespostaApi<T> | T> {
    if (context.getType() !== 'http') return next.handle();

    const mensagem = this.reflector.getAllAndOverride<string | undefined>(
      MENSAGEM_RESPOSTA,
      [context.getHandler(), context.getClass()],
    );

    return next.handle().pipe(
      map((dados) => {
        // Evita embrulhar duas vezes uma resposta que já veio no formato do envelope.
        if (jaEhEnvelope(dados)) return dados;
        return {
          sucesso: true,
          ...(mensagem ? { mensagem } : {}),
          dados: dados ?? null,
          erros: [],
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}

function jaEhEnvelope(valor: unknown): valor is RespostaApi {
  if (typeof valor !== 'object' || valor === null) return false;
  const candidato = valor as Record<string, unknown>;
  return (
    typeof candidato.sucesso === 'boolean' &&
    typeof candidato.timestamp === 'string' &&
    'dados' in candidato
  );
}
