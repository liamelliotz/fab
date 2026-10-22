import {
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { UsuarioAutenticado } from '../decorators/usuario-atual.decorator.js';

/**
 * Guard GLOBAL (registrado no AuthModule): toda rota exige token Bearer válido,
 * exceto as marcadas com @Public().
 * Falha de token: 401 no envelope, com mensagem em português.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {
    super();
  }

  override canActivate(contexto: ExecutionContext) {
    const rotaPublica = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [contexto.getHandler(), contexto.getClass()],
    );
    if (rotaPublica) {
      return true;
    }
    return super.canActivate(contexto);
  }

  override handleRequest<TUser = UsuarioAutenticado>(
    erro: unknown,
    usuario: TUser | false,
    info: unknown,
  ): TUser {
    // Erro lançado pelo JwtStrategy (ex.: conta inativa) ou falha inesperada: segue como está.
    if (erro) {
      throw erro;
    }
    if (!usuario) {
      // `info` traz o motivo do Passport: sem token, malformado, assinatura errada ou expirado.
      const expirou =
        info instanceof Error && info.name === 'TokenExpiredError';
      throw new UnauthorizedException(
        expirou
          ? 'Sessão expirada. Entre novamente.'
          : 'Não autenticado. Entre novamente.',
      );
    }
    return usuario;
  }
}
