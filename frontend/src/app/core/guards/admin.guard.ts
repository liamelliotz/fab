import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';

/**
 * ADMIN GUARD: só deixa entrar no painel administrativo quem tem o perfil admin.
 */
export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  // No servidor (SSR) não existe localStorage. Deixa passar e o navegador valida depois.
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const token = localStorage.getItem('fab_token');
  // toLowerCase: aceita 'admin', 'Admin' ou 'ADMIN' (o modelo de dados usa minúsculas)
  const role = localStorage.getItem('fab_role')?.toLowerCase();

  // Logado e com perfil admin: libera
  if (token && role === 'admin') {
    return true;
  }

  // Logado, mas não é Admin: manda para o painel comum
  if (token) {
    router.navigate(['/dashboard']);
    return false;
  }

  // Não logado: manda para o login
  router.navigate(['/login']);
  return false;
};