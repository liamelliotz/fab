import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { EMPTY, Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { API_URL } from '../constants/api.constants';

/**
 * Endpoints públicos que não necessitam do cabeçalho de autenticação.
 * Previne envio desnecessário de token ou problemas de CORS em rotas abertas.
 */
const RotasPublicas: string[] = [
  '/auth/login',
  '/auth/recuperar-senha',
  '/auth/redefinir-senha',
];

/**
 * Interceptador funcional que anexa o token JWT ao cabeçalho da requisição.
 *
 * @param req Requisição HTTP original que sai do cliente.
 * @param next Próximo manipulador da cadeia HTTP.
 * @returns Observable com o evento HTTP clonado e modificado (caso autenticado).
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> => {
  const authService = inject(AuthService);

  // Verifica se a URL chamada corresponde a um endpoint de autenticação pública
  const base = API_URL.replace(/\/+$/, '');
  const daApi = req.url === base || req.url.startsWith(`${base}/`) || req.url.startsWith(`${base}?`);
  const ehRotaPublica = RotasPublicas.some((rota) => req.url.split('?')[0] === `${base}${rota}`);

  // No servidor (SSR) não existe a sessão da aba: uma rota protegida voltaria 401 e o
  // error.interceptor mandaria para o login. Essas chamadas ficam para o navegador, que tem o token.
  if (daApi && !ehRotaPublica && !isPlatformBrowser(inject(PLATFORM_ID))) {
    return EMPTY;
  }

  // Obtém o token JWT ativo (geralmente persistido em localStorage/sessionStorage ou signal no AuthService)
  const token = authService.obterToken();

  // Se não for rota pública e existir um token válido, clona a requisição injetando o Header
  if (daApi && !ehRotaPublica && token) {
    const requisicaoAutenticada = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });

    return next(requisicaoAutenticada);
  }

  // Se não houver token ou for endpoint público, segue o fluxo original
  return next(req);
};
