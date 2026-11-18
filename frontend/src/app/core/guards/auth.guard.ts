import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * AUTH GUARD: impede que quem não fez login acesse páginas privadas.
 * Pergunta ao AuthService, que guarda a sessão desta aba (e confere se o token não venceu).
 */
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);

  // No servidor (SSR) não há sessão. Deixa passar e o navegador valida depois.
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return true;
  }

  if (inject(AuthService).estaAutenticado()) {
    return true; // logado: libera a página
  }

  return router.createUrlTree(['/login']); // não logado: vai para o login
};
