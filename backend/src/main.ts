import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { aplicarPadraoDeResposta } from './common/aplicar-padrao-resposta.js';

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
    throw new Error(
      'CORS_ORIGINS deve listar endereços do front-end e não pode conter "*".',
    );
  }
  return origens;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Todas as rotas começam com /api (o front aponta para http://localhost:3000/api).
  app.setGlobalPrefix('api');

  // CORS: só o(s) front-end(s) listados podem chamar a API pelo navegador.
  app.enableCors({
    origin: lerOrigensPermitidas(config.get<string>('CORS_ORIGINS')),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Validação global dos DTOs (class-validator):
  // - whitelist: descarta campos que não existem no DTO;
  // - transform: converte o corpo da requisição para a classe do DTO.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Padrão de resposta (Card 2): envelope { sucesso, mensagem, dados, erros, timestamp } em
  // toda resposta, inclusive nos erros (400, 401, 403, 404, 409 e 500).
  aplicarPadraoDeResposta(app);

  // Swagger em /api/docs, com botão "Authorize" para colar o token Bearer (JWT).
  const documento = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('FAB API')
      .setDescription('API de gestão de empréstimos de equipamentos do FAB.')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api/docs', app, documento);

  const porta = Number(config.get('PORT') ?? 3000);
  await app.listen(porta);

  const logger = new Logger('Bootstrap');
  logger.log(`API no ar: http://localhost:${porta}/api`);
  logger.log(`Swagger:   http://localhost:${porta}/api/docs`);
}
await bootstrap();
