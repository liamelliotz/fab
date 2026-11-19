/**
 * "ESQUECI MINHA SENHA" (card A5)
 * ======================================================================================
 * 1. POST /auth/recuperar-senha { email }
 *    Se o e-mail for de uma conta ativa, gera um token aleatório (32 bytes), guarda só o
 *    HASH SHA-256 com validade de 30 minutos e monta o link de redefinição.
 *    Nesta versão não há envio de e-mail: fora de produção o link aparece no LOG da API.
 *    Em produção, nunca vai para o log.
 *    A resposta é SEMPRE a mesma (exista o e-mail ou não), para ninguém descobrir quem
 *    tem conta.
 *
 * 2. POST /auth/redefinir-senha { token, novaSenha }
 *    Confere o hash, a validade e se já foi usado; troca a senha e marca o token como
 *    usado (uso único). Os outros links pendentes do usuário deixam de valer.
 * ======================================================================================
 */
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { StatusUsuario } from '../../common/enums/index.js';
import { UsuariosService } from '../../usuarios/usuarios.service.js';
import { TokensRedefinicaoRepository } from './tokens-redefinicao.repository.js';

/** Validade do link de redefinição. */
export const VALIDADE_DO_LINK_MS = 30 * 60 * 1000;

/** Resposta do pedido: igual para e-mail que existe e que não existe. */
export const MENSAGEM_RECUPERACAO =
  'Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.';

/** SHA-256 em hexadecimal: é isto que vai para o banco, nunca o token. */
export function hashDoToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class RedefinicaoSenhaService {
  private readonly logger = new Logger('RecuperarSenha');

  constructor(
    @Inject(UsuariosService) private readonly usuarios: UsuariosService,
    @Inject(TokensRedefinicaoRepository)
    private readonly tokens: TokensRedefinicaoRepository,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  /** Gera o link (se a conta existir e estiver ativa). Nunca revela se o e-mail existe. */
  async recuperar(email: string): Promise<void> {
    const usuario = await this.usuarios.buscarPorEmail(email);
    if (!usuario || usuario.status !== StatusUsuario.Ativo) return;

    const token = randomBytes(32).toString('base64url');
    const agora = Date.now();
    await this.tokens.criar({
      usuarioId: usuario.id,
      tokenHash: hashDoToken(token),
      expiraEm: new Date(agora + VALIDADE_DO_LINK_MS).toISOString(),
      criadoEm: new Date(agora).toISOString(),
    });

    if (this.config.get<string>('NODE_ENV') !== 'production') {
      this.logger.log(
        `Link de redefinição para ${usuario.email} (vale 30 min): ${this.montarLink(token)}`,
      );
    }
  }

  /** Troca a senha com o token do link. Token inválido, vencido ou já usado: 400. */
  async redefinir(token: string, novaSenha: string): Promise<void> {
    const tokenHash = hashDoToken(token);
    const agora = new Date().toISOString();
    const registro = await this.tokens.buscarPorHash(tokenHash);

    if (!registro) {
      throw new BadRequestException(
        'Link de redefinição inválido. Peça um novo.',
      );
    }
    if (registro.usadoEm) {
      throw new BadRequestException('Este link já foi usado. Peça um novo.');
    }
    if (registro.expiraEm <= agora) {
      throw new BadRequestException('Este link expirou. Peça um novo.');
    }
    // Marca como usado ANTES de trocar a senha: dois pedidos ao mesmo tempo, só um passa.
    if (!(await this.tokens.consumir(tokenHash, agora))) {
      throw new BadRequestException('Este link já foi usado. Peça um novo.');
    }

    await this.usuarios.alterarSenha(registro.usuarioId, novaSenha);
    await this.tokens.invalidarDoUsuario(registro.usuarioId, agora);
  }

  /** Endereço da tela do front que recebe o token. FRONTEND_URL ou o 1º de CORS_ORIGINS. */
  private montarLink(token: string): string {
    const base =
      this.config.get<string>('FRONTEND_URL')?.trim() ||
      this.config.get<string>('CORS_ORIGINS')?.split(',')[0]?.trim() ||
      'http://localhost:4200';
    return `${base.replace(/\/+$/, '')}/redefinir-senha?token=${token}`;
  }
}
