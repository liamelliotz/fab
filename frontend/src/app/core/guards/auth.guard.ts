import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';

/**
 * AUTH GUARD: impede que quem não fez login acesse páginas privadas.
 */
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  // No servidor (SSR) não existe localStorage. Deixa passar e o navegador valida depois.
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  // Token gravado no navegador após o login
  const token = localStorage.getItem('fab_token');

  if (token) {
    return true; // logado: libera a página
  }

  router.navigate(['/login']); // não logado: vai para o login
  return false;
};