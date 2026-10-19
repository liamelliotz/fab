import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

// Única origem liberada no CORS: o front-end Angular em desenvolvimento.
const ORIGEM_FRONTEND = 'http://localhost:4200';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Todas as rotas começam com /api (o front aponta para http://localhost:3000/api).
  app.setGlobalPrefix('api');

  // CORS: só o front-end local pode chamar a API pelo navegador.
  app.enableCors({
    origin: ORIGEM_FRONTEND,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Validação global dos DTOs (class-validator):
  // - whitelist: descarta campos que não existem no DTO;
  // - transform: converte o corpo da requisição para a classe do DTO.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

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
