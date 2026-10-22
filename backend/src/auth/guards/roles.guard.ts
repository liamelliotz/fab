import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { UsuarioAutenticado } from '../decorators/usuario-atual.decorator.js';

/**
 * Guard GLOBAL (registrado no AuthModule, DEPOIS do JwtAuthGuard): confere o @Roles() da rota.
 * Sem @Roles, qualquer logado passa. Perfil insuficiente: 403 no envelope.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const alvos = [contexto.getHandler(), contexto.getClass()];

    const rotaPublica = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      alvos,
    );
    if (rotaPublica) {
      return true;
    }

    const perfis = this.reflector.getAllAndOverride<
      readonly string[] | undefined
    >(ROLES_KEY, alvos);
    if (!perfis || perfis.length === 0) {
      return true;
    }

    const usuario = contexto
      .switchToHttp()
      .getRequest<{ user?: UsuarioAutenticado }>().user;
    // Não deveria acontecer (o JwtAuthGuard roda antes), mas nunca libere sem saber quem é.
    if (!usuario) {
      throw new UnauthorizedException('Não autenticado. Entre novamente.');
    }
    if (!perfis.includes(usuario.perfil)) {
      throw new ForbiddenException('Você não tem permissão para esta ação.');
    }
    return true;
  }
}
