import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { RespostaApi } from '../dto/resposta-api.dto.js';

/** Mensagens em português para os códigos que o front trata (veja docs/contrato-api.md). */
const MENSAGEM_PADRAO: Record<number, string> = {
  400: 'Requisição inválida.',
  401: 'Não autenticado. Entre novamente.',
  403: 'Você não tem permissão para esta ação.',
  404: 'Recurso não encontrado.',
  405: 'Método não permitido.',
  409: 'Conflito: o registro já existe ou está em uso.',
  413: 'Corpo da requisição muito grande.',
  422: 'Não foi possível processar os dados enviados.',
  429: 'Muitas tentativas. Aguarde um pouco e tente novamente.',
  500: 'Erro interno do servidor. Tente novamente em instantes.',
};

/** Textos em inglês que o próprio NestJS coloca quando ninguém escreveu uma mensagem. */
const MENSAGENS_PADRAO_DO_NEST = new Set([
  'Bad Request',
  'Unauthorized',
  'Forbidden',
  'Not Found',
  'Method Not Allowed',
  'Conflict',
  'Payload Too Large',
  'Unprocessable Entity',
  'Too Many Requests',
  'Internal Server Error',
]);

interface ErroInterpretado {
  status: number;
  mensagem: string;
  erros: string[];
}

/**
 * Captura TODO erro da API e responde no envelope { sucesso: false, mensagem, dados: null, erros, timestamp }.
 *
 * - 400 de validação (class-validator): mensagem "Dados inválidos." e a lista de campos em `erros`.
 * - 401, 403, 404, 409 e demais HttpException: usa a mensagem escrita por quem lançou o erro.
 * - Erro inesperado: 500 com texto genérico (o detalhe vai só para o log, nunca para o cliente).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') throw exception;

    const http = host.switchToHttp();
    const resposta = http.getResponse<Response>();
    const requisicao = http.getRequest<Request>();
    const { status, mensagem, erros } = this.interpretar(exception);

    if (status >= 500) {
      this.logger.error(
        `${requisicao.method} ${requisicao.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    if (resposta.headersSent) return;

    const corpo: RespostaApi<null> = {
      sucesso: false,
      mensagem,
      dados: null,
      erros,
      timestamp: new Date().toISOString(),
    };
    resposta.status(status).json(corpo);
  }

  private interpretar(exception: unknown): ErroInterpretado {
    if (exception instanceof HttpException) {
      return this.deHttpException(exception);
    }

    // Erros de bibliotecas (ex.: JSON malformado no corpo) trazem o status HTTP no próprio objeto.
    const status = statusDoObjeto(exception);
    if (status !== null && status >= 400 && status < 500) {
      const tipo = (exception as { type?: string }).type;
      return {
        status,
        mensagem:
          tipo === 'entity.parse.failed'
            ? 'O corpo da requisição não é um JSON válido.'
            : padrao(status),
        erros: [],
      };
    }

    return { status: 500, mensagem: padrao(500), erros: [] };
  }

  private deHttpException(exception: HttpException): ErroInterpretado {
    const status = exception.getStatus();
    const corpo = exception.getResponse();
    const bruto =
      typeof corpo === 'string'
        ? corpo
        : (corpo as { message?: string | string[] }).message;

    // Lista de mensagens: é o que o ValidationPipe devolve (400) com um item por campo inválido.
    if (Array.isArray(bruto)) {
      return {
        status,
        mensagem: status === 400 ? 'Dados inválidos.' : padrao(status),
        erros: bruto.map(String),
      };
    }

    const texto = typeof bruto === 'string' ? bruto : '';
    return { status, mensagem: traduzir(status, texto), erros: [] };
  }
}

function padrao(status: number): string {
  return (
    MENSAGEM_PADRAO[status] ??
    (status >= 500
      ? MENSAGEM_PADRAO[500]
      : 'Não foi possível concluir a requisição.')
  );
}

/** Mantém a mensagem escrita pelo time e troca só as genéricas em inglês do NestJS. */
function traduzir(status: number, texto: string): string {
  if (!texto) return padrao(status);
  // Rota inexistente: "Cannot GET /api/xyz"
  if (
    status === 404 &&
    /^Cannot (GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD) /.test(texto)
  ) {
    return 'Rota não encontrada.';
  }
  if (
    MENSAGENS_PADRAO_DO_NEST.has(texto) ||
    texto.startsWith('ThrottlerException')
  ) {
    return padrao(status);
  }
  return texto;
}

function statusDoObjeto(valor: unknown): number | null {
  if (typeof valor !== 'object' || valor === null) return null;
  const candidato = valor as { status?: unknown; statusCode?: unknown };
  const status = candidato.statusCode ?? candidato.status;
  return typeof status === 'number' ? status : null;
}
