import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * ADMIN GUARD: só deixa entrar no painel administrativo quem tem o perfil admin.
 */
export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);

  // No servidor (SSR) não há sessão. Deixa passar e o navegador valida depois.
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return true;
  }

  const auth = inject(AuthService);
  if (!auth.estaAutenticado()) {
    return router.createUrlTree(['/login']); // não logado: vai para o login
  }

  // toLowerCase: aceita 'admin', 'Admin' ou 'ADMIN' (o modelo de dados usa minúsculas)
  return auth.obterPerfil()?.toLowerCase() === 'admin'
    ? true
    : router.createUrlTree(['/dashboard']); // logado, mas não é admin
};
