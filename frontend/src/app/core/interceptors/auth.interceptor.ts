import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Endpoints públicos que não necessitam do cabeçalho de autenticação.
 * Previne envio desnecessário de token ou problemas de CORS em rotas abertas.
 */
const RotasPublicas: string[] = [
  '/auth/login',
  '/auth/cadastro',
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
  const ehRotaPublica = RotasPublicas.some((rota) => req.url.includes(rota));

  // Obtém o token JWT ativo (geralmente persistido em localStorage/sessionStorage ou signal no AuthService)
  const token = authService.obterToken();

  // Se não for rota pública e existir um token válido, clona a requisição injetando o Header
  if (!ehRotaPublica && token) {
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
