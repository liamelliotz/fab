import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { configurarApp } from './common/configurar-app.js';
import { ErroDeConfiguracao } from './common/erro-de-configuracao.js';

// Origem liberada no CORS por padrão: o front-end Angular em desenvolvimento (ng serve).
// Para liberar outras (ex.: o build com SSR em http://localhost:4000), use CORS_ORIGINS no .env.
const ORIGEM_PADRAO = 'http://localhost:4200';

/** Lê CORS_ORIGINS (endereços separados por vírgula). Recusa "*": nunca liberar todas as origens. */
function lerOrigensPermitidas(valor: string | undefined): string[] {
  const origens = (valor ?? ORIGEM_PADRAO)
    .split(',')
    .map((origem) => origem.trim())
    .filter(Boolean);

  if (origens.length === 0 || origens.includes('*')) {
    throw new ErroDeConfiguracao(
      'CORS_ORIGINS deve listar endereços do front-end e não pode conter "*".',
    );
  }
  return origens;
}

async function bootstrap() {
  // Importado aqui dentro para que um erro do .env (ex.: PERSISTENCIA inválida), que acontece
  // ao carregar os módulos, também caia no tratamento lá embaixo.
  const { AppModule } = await import('./app.module.js');

  // Os logs da inicialização ficam guardados (bufferLogs) até a API subir. Se ela não subir
  // por erro de configuração, mostramos só a mensagem em português, sem o stack trace.
  const app = await NestFactory.create(AppModule, {
    abortOnError: false,
    bufferLogs: true,
    autoFlushLogs: false,
  });
  app.flushLogs();
  const config = app.get(ConfigService);

  // Prefixo /api, helmet, validação dos DTOs e envelope de resposta (igual nos testes e2e).
  configurarApp(app);

  // CORS: só o(s) front-end(s) listados podem chamar a API pelo navegador.
  app.enableCors({
    origin: lerOrigensPermitidas(config.get<string>('CORS_ORIGINS')),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Swagger em /api/docs, com botão "Authorize" para colar o token Bearer (JWT).
  // Em produção fica desligado, a não ser que SWAGGER_ATIVO=true esteja no .env.
  const emProducao = config.get<string>('NODE_ENV') === 'production';
  const swaggerAtivo =
    !emProducao || config.get<string>('SWAGGER_ATIVO') === 'true';
  if (swaggerAtivo) {
    const documento = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('FAB API')
        .setDescription(
          'API de gestão de empréstimos de equipamentos e de insumos do FAB.',
        )
        .setVersion('2.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, documento);
  }

  const porta = Number(config.get('PORT') ?? 3000);
  await app.listen(porta);

  const logger = new Logger('Bootstrap');
  logger.log(`API no ar: http://localhost:${porta}/api`);
  if (swaggerAtivo) {
    logger.log(`Swagger:   http://localhost:${porta}/api/docs`);
  }
}

try {
  await bootstrap();
} catch (erro) {
  if (erro instanceof ErroDeConfiguracao) {
    Logger.detachBuffer(); // descarta os logs técnicos guardados
    Logger.overrideLogger(['error', 'fatal']); // e os que ainda chegarem atrasados
  } else {
    Logger.flush(); // erro inesperado: mostra tudo, com stack trace
  }
  new Logger('Bootstrap').error(
    `A API não subiu. ${erro instanceof Error ? erro.message : String(erro)}`,
  );
  process.exitCode = 1;
}
