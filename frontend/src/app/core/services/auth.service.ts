import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly TOKEN_KEY = 'fab_auth_token';

  /**
   * Recupera o token de autenticação JWT armazenado.
   * @returns O token em formato string ou null caso não esteja autenticado.
   */
  public obterToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Salva o token JWT no armazenamento local do navegador após login bem-sucedido.
   * @param token String do token JWT recebido da API.
   */
  public salvarToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  /**
   * Verifica se existe uma sessão válida ativa (presença de token).
   * @returns Booleano indicando se o usuário está logado.
   */
  public estaAutenticado(): boolean {
    return !!this.obterToken();
  }

  /**
   * Remove a credencial ativa do cliente e finaliza a sessão.
   */
  public logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }
}