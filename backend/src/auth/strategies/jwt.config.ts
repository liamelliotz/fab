import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { ErroDeConfiguracao } from '../../common/erro-de-configuracao.js';

/** Usado só em desenvolvimento, quando o .env não define JWT_SECRET. */
const SEGREDO_DE_DESENVOLVIMENTO =
  'fab-segredo-de-desenvolvimento-nao-usar-em-producao';

/** Texto que vem no .env.example. Não é um segredo: está publicado no repositório. */
export const SEGREDO_DE_EXEMPLO =
  'troque-este-segredo-por-um-valor-longo-e-aleatorio';

export const TAMANHO_MINIMO_DO_SEGREDO = 32;

let avisou = false;

function avisarUmaVez(mensagem: string): void {
  if (avisou) return;
  avisou = true;
  new Logger('Auth').warn(mensagem);
}

/**
 * Segredo que assina os tokens.
 *
 * Em produção (NODE_ENV=production) a API NÃO sobe se o JWT_SECRET estiver ausente, for o
 * texto do .env.example ou tiver menos de 32 caracteres. Em desenvolvimento, só avisa no log.
 */
export function obterSegredoJwt(config: ConfigService): string {
  const segredo = config.get<string>('JWT_SECRET')?.trim() ?? '';
  const emProducao = config.get<string>('NODE_ENV') === 'production';
  const fraco =
    segredo === SEGREDO_DE_EXEMPLO ||
    segredo === SEGREDO_DE_DESENVOLVIMENTO ||
    segredo.length < TAMANHO_MINIMO_DO_SEGREDO;

  if (emProducao && fraco) {
    throw new ErroDeConfiguracao(
      `JWT_SECRET ausente ou fraco. Em produção ele precisa ter ao menos ${TAMANHO_MINIMO_DO_SEGREDO} caracteres aleatórios ` +
        "e não pode ser o texto do .env.example. Gere um com: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"",
    );
  }
  if (!segredo) {
    avisarUmaVez(
      'JWT_SECRET não definido: usando segredo de desenvolvimento. Copie .env.example para .env.',
    );
    return SEGREDO_DE_DESENVOLVIMENTO;
  }
  if (fraco) {
    avisarUmaVez(
      'JWT_SECRET fraco (texto de exemplo ou curto). Serve para desenvolver, mas troque antes de publicar.',
    );
  }
  return segredo;
}

/** Validade do token de acesso (padrão 8h, a mesma da sessão do front). */
export function obterExpiracaoJwt(config: ConfigService): string {
  return config.get<string>('JWT_EXPIRES_IN')?.trim() || '8h';
}
