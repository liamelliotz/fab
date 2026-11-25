import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_URL, ENDPOINTS } from '../constants/api.constants';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const notificacoes = inject(NotificationService);
  const base = API_URL.replace(/\/+$/, '');
  const daApi = req.url === base || req.url.startsWith(`${base}/`) || req.url.startsWith(`${base}?`);
  return next(req).pipe(catchError((erro: HttpErrorResponse) => {
    if (!daApi) return throwError(() => erro);
    const corpo = erro.error;
    const erros: string[] = Array.isArray(corpo?.erros)
      ? corpo.erros.filter((item: unknown): item is string => typeof item === 'string') : [];
    const padrao = erro.status === 0 ? 'Não foi possível conectar à API.'
      : erro.status === 429 ? 'Muitas tentativas. Aguarde antes de tentar novamente.'
      : erro.status === 401 ? 'Sessão inválida ou credenciais incorretas.'
      : erro.status === 403 ? 'Você não tem permissão para realizar esta operação.'
      : erro.status >= 500 ? 'Não foi possível concluir a operação. Tente novamente mais tarde.'
      : 'Não foi possível concluir a operação.';
    const mensagem = typeof corpo?.mensagem === 'string' && corpo.mensagem.trim() ? corpo.mensagem : padrao;
    const caminho = req.url.split('?')[0];
    const login = caminho === `${base}${ENDPOINTS.auth.login}`;
    // Login e telas de senha mostram o erro no próprio formulário: o aviso global seria repetido.
    const telaDeAcesso = [ENDPOINTS.auth.login, ENDPOINTS.auth.recuperarSenha, ENDPOINTS.auth.redefinirSenha]
      .some((rota) => caminho === `${base}${rota}`);
    // Validações ficam visíveis até o usuário fechar, para permitir a leitura de todos os campos.
    if (telaDeAcesso) { /* a própria tela avisa */ }
    else if (erro.status === 429) notificacoes.aviso(mensagem, erros.length ? 0 : 10000, erros);
    else notificacoes.erro(mensagem, erros.length ? 0 : 7000, erros);
    if (erro.status === 401) {
      auth.logout();
      if (!login) void router.navigate(['/login'], { queryParams: { sessaoExpirada: 'true' } });
    } else if (erro.status === 403 && !login) {
      void router.navigate(['/dashboard']);
    }
    return throwError(() => erro);
  }));
};
