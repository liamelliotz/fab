import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

/** Usado só quando o .env não define JWT_SECRET e a API NÃO está em produção. */
const SEGREDO_DE_DESENVOLVIMENTO =
  'fab-segredo-de-desenvolvimento-nao-usar-em-producao';

let avisou = false;

/**
 * Segredo que assina e confere os tokens JWT (JWT_SECRET no .env).
 * Em produção (NODE_ENV=production) ele é obrigatório. Em desenvolvimento, se faltar,
 * usa um segredo fixo e avisa no log, para a API (e os testes e2e) subirem sem .env.
 */
export function obterSegredoJwt(config: ConfigService): string {
  const segredo = config.get<string>('JWT_SECRET')?.trim();
  if (segredo) {
    return segredo;
  }
  if (config.get<string>('NODE_ENV') === 'production') {
    throw new Error('JWT_SECRET não está definido. Configure-o no .env.');
  }
  if (!avisou) {
    avisou = true;
    new Logger('Auth').warn(
      'JWT_SECRET não definido: usando segredo de desenvolvimento. Copie .env.example para .env.',
    );
  }
  return SEGREDO_DE_DESENVOLVIMENTO;
}

/** Validade do token (JWT_EXPIRES_IN no .env, ex.: "8h"). Padrão: 8h. */
export function obterExpiracaoJwt(config: ConfigService): string {
  return config.get<string>('JWT_EXPIRES_IN')?.trim() || '8h';
}
