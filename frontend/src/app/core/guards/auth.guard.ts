import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const auth = inject(AuthService);
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;
  return auth.obterToken() ? true : router.createUrlTree(['/login']);
};
