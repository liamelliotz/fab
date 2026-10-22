import { SetMetadata } from '@nestjs/common';
import type { Perfil } from '../../common/enums/index.js';

export const ROLES_KEY = 'perfisPermitidos';

/** Aceita `'admin'` e `Perfil.Admin` (o `${Perfil}` vira 'admin' | 'usuario'). */
type PerfilPermitido = Perfil | `${Perfil}`;

/**
 * Restringe a rota (ou o controller inteiro) a certos perfis. Quem não tem o perfil recebe 403.
 * O decorator da rota vale mais do que o do controller. Sem @Roles, qualquer logado entra.
 *
 *   @Roles('admin')
 *   @Get()
 *   listar() { ... }
 */
export const Roles = (...perfis: PerfilPermitido[]) =>
  SetMetadata(ROLES_KEY, perfis);
