import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Perfil } from '../../common/enums/index.js';

/** Quem está fazendo a requisição (o que o JwtStrategy coloca em `request.user`). */
export interface UsuarioAutenticado {
  /** Id do usuário. */
  sub: string;
  email: string;
  perfil: Perfil;
}

/**
 * Entrega o usuário logado ao método do controller. Só faz sentido em rota protegida
 * (em rota @Public() não há usuário e o valor é `undefined`).
 *
 *   @Get('meus')
 *   meus(@UsuarioAtual() usuario: UsuarioAutenticado) { ... }   // { sub, email, perfil }
 *
 *   @Get('meus')
 *   meus(@UsuarioAtual('sub') usuarioId: string) { ... }        // só o id
 */
export const UsuarioAtual = createParamDecorator(
  (campo: keyof UsuarioAutenticado | undefined, contexto: ExecutionContext) => {
    const requisicao = contexto
      .switchToHttp()
      .getRequest<{ user?: UsuarioAutenticado }>();
    return campo ? requisicao.user?.[campo] : requisicao.user;
  },
);
