import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * ADMIN GUARD: só deixa entrar no painel administrativo quem tem o perfil admin.
 * O perfil vem do próprio token (não de uma chave solta no navegador).
 * O guard só orienta a navegação: a API continua validando JWT e permissões.
 */
export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);

  // No servidor (SSR) não há sessão. Deixa passar e o navegador valida depois.
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return true;
  }

  const auth = inject(AuthService);
  if (!auth.obterToken()) {
    return router.createUrlTree(['/login']); // não logado: vai para o login
  }
  return auth.obterPerfil() === 'admin' ? true : router.createUrlTree(['/dashboard']);
};
