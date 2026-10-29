import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
// isPlatformBrowser: diz se o código está rodando no navegador (true) ou no servidor SSR (false)
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, defer, delay, map, of, tap, throwError } from 'rxjs';
// Contratos de dados criados no Card 3
import { ApiResponse } from '../models/api-response.model';
import { API_URL, ENDPOINTS } from '../constants/api.constants';
import { AuthResponse, JwtPayload, LoginCredenciaisDTO } from '../models/auth.model';
import { PerfilUsuario, UsuarioResumo } from '../models/usuario.model';
import { UsuarioDemo, UsuarioService } from './usuario.service';

// Chaves usadas no localStorage. fab_token e fab_role são as MESMAS lidas pelos guards.
const CHAVE_TOKEN = 'fab_token';
const CHAVE_PERFIL = 'fab_role';
const CHAVE_NOME = 'fab_nome';

/**
 * MODO DEMONSTRAÇÃO
 * true  = não precisa de backend: o login usa as contas do UsuarioService (que o administrador
 *         gerencia na tela de Usuários) e tudo fica salvo só neste navegador. Serve para apresentar o protótipo.
 * false = usa a API real (API_URL, definida em environments/).
 * ATENÇÃO: no modo demonstração as senhas ficam em texto puro no navegador. Nunca use em produção.
 */
const MODO_DEMO: boolean = true;

@Injectable({ providedIn: 'root' }) // um único AuthService para o app inteiro
export class AuthService {
  private http = inject(HttpClient);
  private usuarios = inject(UsuarioService);
  private platformId = inject(PLATFORM_ID);
  // No servidor (SSR) não existe localStorage, então só usamos no navegador
  private ehNavegador = isPlatformBrowser(this.platformId);

  // ---------- Estado da sessão (signals: a tela atualiza sozinha quando mudam) ----------
  // Ao iniciar o app, recupera a sessão salva (o usuário continua logado após F5)
  private token = signal<string | null>(this.lerStorage(CHAVE_TOKEN));
  private perfil = signal<string | null>(this.lerStorage(CHAVE_PERFIL));
  private nome = signal<string | null>(this.lerStorage(CHAVE_NOME));

  /** Perfil do usuário logado (ex.: 'admin') ou null. */
  readonly perfilAtual = this.perfil.asReadonly();

  /** Nome do usuário logado (para mostrar em saudações) ou null. */
  readonly nomeAtual = this.nome.asReadonly();

  /** true quando existe um token e ele ainda não expirou. */
  readonly estaAutenticado = computed(() => {
    const token = this.token();
    return !!token && !this.tokenExpirado(token);
  });

  // ---------- Autenticação ----------

  /**
   * Faz o login. Se aceito, guarda o token e o perfil e devolve a resposta.
   * Se falhar (ex.: 401), o erro sobe para o componente exibir a mensagem.
   */
  login(credenciais: LoginCredenciaisDTO): Observable<AuthResponse> {
    const resposta$ = MODO_DEMO
      ? this.loginDemo(credenciais)
      : this.http
          .post<ApiResponse<AuthResponse>>(`${API_URL}${ENDPOINTS.auth.login}`, credenciais)
          .pipe(map((resposta) => resposta.dados)); // tira o "envelope" da API

    // Persiste token, perfil e nome
    return resposta$.pipe(tap((auth) => this.salvarSessao(auth.tokenAcesso, auth.usuario?.nome)));
  }

  /**
   * Rota para onde o usuário vai depois de entrar:
   * todos os perfis entram pelo dashboard.
   */
  rotaInicial(): string {
    return '/dashboard'; // o dashboard é a página inicial de todos os perfis
  }

  /** Dados resumidos do usuário logado (id e e-mail vêm de dentro do token). */
  usuarioAtual(): UsuarioResumo {
    const dados = this.decodificarToken(this.token() ?? '');
    return {
      id: dados?.sub ?? 'anonimo',
      nome: this.nome() ?? 'Usuário',
      email: dados?.email ?? '',
      perfil: (dados?.perfil as PerfilUsuario) ?? 'usuario',
    };
  }

  /** true quando o app roda no modo demonstração (sem backend). A barra amarela de demonstração só aparece assim. */
  readonly modoDemo: boolean = MODO_DEMO;

  /**
   * Modo demonstração: entra como uma das contas do UsuarioService sem digitar senha
   * (usado pela barra de demonstração para mostrar os dois lados de um fluxo).
   * Devolve false se a conta não existe, está inativa ou se o modo demonstração está desligado.
   */
  entrarComoDemo(id: string): boolean {
    if (!MODO_DEMO) return false;
    const conta = this.usuarios.buscarPorId(id);
    if (!conta || conta.status !== 'ativo') return false;
    this.salvarSessao(this.gerarTokenDemo(conta), conta.nome);
    return true;
  }

  /** Encerra a sessão: apaga token, perfil e nome (memória e localStorage). */
  logout(): void {
    this.limparSessao();
  }

  // ---------- Consultas (usadas por interceptors, guards e telas) ----------

  /** Token atual (o auth.interceptor usa este método para montar o "Bearer"). */
  obterToken(): string | null {
    return this.token();
  }

  /** Perfil atual (ex.: 'admin'). */
  obterPerfil(): string | null {
    return this.perfil();
  }

  // ---------- Modo demonstração (sem backend) ----------

  /** Valida e-mail e senha nas contas do UsuarioService (as de exemplo e as criadas pelo administrador). */
  private loginDemo(credenciais: LoginCredenciaisDTO): Observable<AuthResponse> {
    return defer(() => {
      const { usuario: conta, erro } = this.usuarios.autenticar(credenciais.email, credenciais.senha);

      if (!conta) {
        // Mesmos erros que a API devolveria: 401 para credencial errada e 403 para conta desativada
        return throwError(
          () =>
            new HttpErrorResponse(
              erro === 'inativo'
                ? { status: 403, statusText: 'Forbidden' }
                : { status: 401, statusText: 'Unauthorized' },
            ),
        );
      }

      const resposta: AuthResponse = {
        tokenAcesso: this.gerarTokenDemo(conta),
        tipoToken: 'Bearer',
        expiraEm: 8 * 60 * 60,
        usuario: {
          id: conta.id,
          nome: conta.nome,
          email: conta.email,
          cpf: conta.cpf,
          telefone: conta.telefone,
          perfil: conta.perfil,
          status: conta.status,
          criadoEm: conta.criadoEm,
        },
      };
      return of(resposta).pipe(delay(400)); // pequena espera, como numa requisição de verdade
    });
  }

  /** Monta um "token" de mentira (sem assinatura) só para o modo demonstração. */
  private gerarTokenDemo(conta: Pick<UsuarioDemo, 'id' | 'email' | 'perfil'>): string {
    const agora = Math.floor(Date.now() / 1000);
    const codificar = (obj: object) =>
      btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_'); // base64url
    const cabecalho = codificar({ alg: 'none', typ: 'JWT' });
    const dados = codificar({
      sub: conta.id,
      email: conta.email,
      perfil: conta.perfil,
      iat: agora,
      exp: agora + 8 * 60 * 60,
    });
    return `${cabecalho}.${dados}.demo`;
  }

  // ---------- Persistência ----------

  /** Guarda token, perfil (lido de dentro do JWT) e nome na memória e no localStorage. */
  private salvarSessao(token: string, nome?: string): void {
    const perfil = this.decodificarToken(token)?.perfil ?? null;

    this.token.set(token);
    this.perfil.set(perfil);
    this.nome.set(nome ?? null);

    this.escreverStorage(CHAVE_TOKEN, token);
    if (perfil) {
      this.escreverStorage(CHAVE_PERFIL, perfil);
    } else {
      this.removerStorage(CHAVE_PERFIL);
    }
    if (nome) {
      this.escreverStorage(CHAVE_NOME, nome);
    } else {
      this.removerStorage(CHAVE_NOME);
    }
  }

  /** Apaga tudo que identifica o usuário logado. */
  private limparSessao(): void {
    this.token.set(null);
    this.perfil.set(null);
    this.nome.set(null);
    this.removerStorage(CHAVE_TOKEN);
    this.removerStorage(CHAVE_PERFIL);
    this.removerStorage(CHAVE_NOME);
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