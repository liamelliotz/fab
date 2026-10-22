import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { StatusUsuario, type Perfil } from '../../common/enums/index.js';
import { UsuariosService } from '../../usuarios/usuarios.service.js';
import type { UsuarioAutenticado } from '../decorators/usuario-atual.decorator.js';
import { obterSegredoJwt } from './jwt.config.js';

/** O que vai dentro do token (o Card 5 assina com estes campos). `iat` e `exp` são do JWT. */
export interface JwtPayload {
  /** Id do usuário. */
  sub: string;
  email: string;
  perfil: Perfil;
  iat?: number;
  exp?: number;
}

/**
 * Valida o token Bearer de toda requisição protegida.
 * O Passport já confere assinatura e validade; o `validate` abaixo confere a conta.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  // @Inject explícito: não depende do metadata de tipos (que o Vitest/esbuild não emite).
  constructor(
    @Inject(ConfigService) config: ConfigService,
    @Inject(UsuariosService) private readonly usuarios: UsuariosService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: obterSegredoJwt(config),
      algorithms: ['HS256'],
    });
  }

  /**
   * Roda só com token válido. O usuário é buscado de novo a cada requisição: se a conta foi
   * apagada, desativada ou bloqueada, ou se o perfil mudou, o efeito é imediato (o token
   * antigo não vale mais nem dá acesso com o perfil antigo).
   * O retorno vira `request.user` (é o que o @UsuarioAtual() entrega).
   */
  async validate(payload: JwtPayload): Promise<UsuarioAutenticado> {
    const usuario = await this.usuarios.buscarPorId(payload.sub);
    if (!usuario || usuario.status !== StatusUsuario.Ativo) {
      throw new UnauthorizedException('Conta inexistente ou inativa.');
    }
    return { sub: usuario.id, email: usuario.email, perfil: usuario.perfil };
  }
}
