import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

/**
 * Intercepta as respostas HTTP e trata status de erro conhecidos da API.
 * 
 * @param req Requisição HTTP em trânsito.
 * @param next Próximo manipulador da cadeia HTTP.
 * @returns Observable do fluxo HTTP com tratamento de exceções.
 */
export const errorInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const router = inject(Router);
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((erro: HttpErrorResponse) => {
      // 1. Tratamento para Token expirado, inválido ou sessão inexistente
      if (erro.status === 401) {
        // Encerra sessão local (remove token, limpa signals/estados)
        authService.logout();

        // Não redireciona se o 401 ocorreu já na própria tentativa de login (credenciais erradas)
        if (!req.url.includes('/auth/login')) {
          router.navigate(['/auth/login'], {
            queryParams: { sessaoExpirada: 'true' }
          });
        }
      }

      // 2. Tratamento para Acesso Não Autorizado (perfil insuficiente, ex: usuário tentando acessar admin)
      if (erro.status === 403) {
        console.warn('Acesso negado: você não tem permissão para realizar esta operação.');
        // Pode redirecionar para uma página 403 ou dashboard do usuário
        router.navigate(['/dashboard']);
      }

      // 3. Tratamento para Falhas Internas do Servidor (500) ou Indisponibilidade (503)
      if (erro.status >= 500) {
        console.error('Falha de infraestrutura no servidor FAB:', erro.message);
      }

      // Repassa o erro original para que os services ou componentes tratem mensagens específicas em tela
      return throwError(() => erro);
    })
  );
};