import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
// isPlatformBrowser: diz se o código está rodando no navegador (true) ou no servidor SSR (false)
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
// Contratos de dados criados no Card 3
import { ApiResponse } from '../models/api-response.model';
import { AuthResponse, JwtPayload, LoginCredenciaisDTO } from '../models/auth.model';

// Chaves usadas no localStorage. São as MESMAS lidas pelos guards (auth.guard e admin.guard).
const CHAVE_TOKEN = 'fab_token';
const CHAVE_PERFIL = 'fab_role';

// TODO: trocar pelo endereço real da API (ex.: valor em core/constants ou environments)
const API_URL = 'http://localhost:3000/api';

/** Dados enviados ao criar uma conta (vindos do formulário de cadastro). */
export interface CadastroPayload {
  nome: string;
  email: string;
  cpf: string;      // somente números
  senha: string;
  telefone: string; // somente números
}

@Injectable({ providedIn: 'root' }) // um único AuthService para o app inteiro
export class AuthService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  // No servidor (SSR) não existe localStorage, então só usamos no navegador
  private ehNavegador = isPlatformBrowser(this.platformId);

  // ---------- Estado da sessão (signals: a tela atualiza sozinha quando mudam) ----------
  // Ao iniciar o app, recupera a sessão salva (o usuário continua logado após F5)
  private token = signal<string | null>(this.lerStorage(CHAVE_TOKEN));
  private perfil = signal<string | null>(this.lerStorage(CHAVE_PERFIL));

  /** Perfil do usuário logado (ex.: 'Admin') ou null. */
  readonly perfilAtual = this.perfil.asReadonly();

  /** true quando existe um token e ele ainda não expirou. */
  readonly estaAutenticado = computed(() => {
    const token = this.token();
    return !!token && !this.tokenExpirado(token);
  });

  // ---------- Autenticação e registo ----------

  /**
   * Faz o login. Se a API aceitar, guarda o token e o perfil e devolve a resposta.
   * Se falhar (ex.: 401), o erro sobe para o componente exibir a mensagem.
   */
  login(credenciais: LoginCredenciaisDTO): Observable<AuthResponse> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${API_URL}/auth/login`, credenciais)
      .pipe(
        map((resposta) => resposta.dados),                      // tira o "envelope" da API
        tap((auth) => this.salvarSessao(auth.tokenAcesso)),     // persiste token e perfil
      );
  }

  /** Cria uma conta nova. Não faz login automático: depois do cadastro o usuário entra pelo login. */
  cadastrar(dados: CadastroPayload): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${API_URL}/auth/cadastro`, dados);
  }

  /** Encerra a sessão: apaga token e perfil (memória e localStorage). */
  logout(): void {
    this.limparSessao();
  }

  // ---------- Consultas (usadas por interceptors, guards e telas) ----------

  /** Token atual (o auth.interceptor usa este método para montar o "Bearer"). */
  obterToken(): string | null {
    return this.token();
  }

  /** Perfil atual (ex.: 'Admin'). */
  obterPerfil(): string | null {
    return this.perfil();
  }

  // ---------- Persistência ----------

  /** Guarda o token e o perfil (lido de dentro do JWT) na memória e no localStorage. */
  private salvarSessao(token: string): void {
    const perfil = this.decodificarToken(token)?.perfil ?? null;

    this.token.set(token);
    this.perfil.set(perfil);

    this.escreverStorage(CHAVE_TOKEN, token);
    if (perfil) {
      this.escreverStorage(CHAVE_PERFIL, perfil);
    } else {
      this.removerStorage(CHAVE_PERFIL);
    }
  }

  /** Apaga tudo que identifica o usuário logado. */
  private limparSessao(): void {
    this.token.set(null);
    this.perfil.set(null);
    this.removerStorage(CHAVE_TOKEN);
    this.removerStorage(CHAVE_PERFIL);
  }

  // ---------- Apoio ----------

  /** Lê o conteúdo (payload) do JWT sem validar assinatura (quem valida é a API). */
  private decodificarToken(token: string): JwtPayload | null {
    try {
      const parteDados = token.split('.')[1];                              // JWT = cabeçalho.dados.assinatura
      const base64 = parteDados.replace(/-/g, '+').replace(/_/g, '/');     // base64url -> base64
      return JSON.parse(atob(base64)) as JwtPayload;
    } catch {
      return null; // token malformado
    }
  }

  /** true se o token tem data de expiração (exp, em segundos) e ela já passou. */
  private tokenExpirado(token: string): boolean {
    const exp = this.decodificarToken(token)?.exp;
    return exp ? exp * 1000 < Date.now() : false;
  }

  // Acesso seguro ao localStorage (ignora quando está no servidor ou quando o navegador bloqueia)
  private lerStorage(chave: string): string | null {
    if (!this.ehNavegador) return null;
    try {
      return localStorage.getItem(chave);
    } catch {
      return null;
    }
  }

  private escreverStorage(chave: string, valor: string): void {
    if (!this.ehNavegador) return;
    try {
      localStorage.setItem(chave, valor);
    } catch {
      /* armazenamento indisponível: a sessão fica só na memória */
    }
  }

  private removerStorage(chave: string): void {
    if (!this.ehNavegador) return;
    try {
      localStorage.removeItem(chave);
    } catch {
      /* ignora */
    }
  }
}