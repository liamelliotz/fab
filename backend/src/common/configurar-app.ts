import { ValidationPipe, type INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { aplicarPadraoDeResposta } from './aplicar-padrao-resposta.js';

/**
 * Configuração que vale para a API de verdade (main.ts) E para os testes e2e.
 * Os testes chamam esta mesma função, então testam a API como ela roda:
 * mesmo prefixo, mesma validação, mesmo envelope e mesmos cabeçalhos.
 */
export function configurarApp(app: INestApplication): void {
  // Todas as rotas começam com /api (o front aponta para http://localhost:3000/api).
  app.setGlobalPrefix('api');

  // Cabeçalhos de segurança (tira o X-Powered-By, liga nosniff, HSTS etc.).
  app.use(helmet());

  // Validação global dos DTOs (class-validator):
  // - whitelist: descarta campos que não existem no DTO;
  // - transform: converte o corpo e a query string para a classe do DTO.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Envelope { sucesso, mensagem, dados, erros, timestamp } em toda resposta, inclusive erros.
  aplicarPadraoDeResposta(app);
}
