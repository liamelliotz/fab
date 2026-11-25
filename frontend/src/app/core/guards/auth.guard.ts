import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * AUTH GUARD: impede que quem não fez login acesse páginas privadas.
 * Pergunta ao AuthService, que guarda a sessão desta aba e só devolve token que ainda não venceu.
 * O guard só orienta a navegação: quem valida o JWT de verdade é a API.
 */
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);

  // No servidor (SSR) não há sessão. Deixa passar e o navegador valida depois.
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return true;
  }

  return inject(AuthService).obterToken() ? true : router.createUrlTree(['/login']);
};
