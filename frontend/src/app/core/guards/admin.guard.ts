import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** O guard orienta a navegação; a API continua responsável por validar JWT e permissões. */
export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const auth = inject(AuthService);
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;
  if (!auth.obterToken()) return router.createUrlTree(['/login']);
  return auth.obterPerfil() === 'admin' ? true : router.createUrlTree(['/dashboard']);
};
