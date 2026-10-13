import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
// isPlatformBrowser: diz se o código está rodando no navegador (true) ou no servidor SSR (false)
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, defer, delay, map, of, switchMap, tap, throwError } from 'rxjs';
// Contratos de dados criados no Card 3
import { ApiResponse } from '../models/api-response.model';
import { AuthResponse, JwtPayload, LoginCredenciaisDTO } from '../models/auth.model';
import { PerfilUsuario, UsuarioResumo } from '../models/usuario.model';

// Chaves usadas no localStorage. fab_token e fab_role são as MESMAS lidas pelos guards.
const CHAVE_TOKEN = 'fab_token';
const CHAVE_PERFIL = 'fab_role';
const CHAVE_NOME = 'fab_nome';
const CHAVE_CONTAS_DEMO = 'fab_demo_contas';

// TODO: trocar pelo endereço real da API (ex.: valor em core/constants ou environments)
const API_URL = 'http://localhost:3000/api';

/**
 * MODO DEMONSTRAÇÃO
 * true  = não precisa de backend: o login usa as contas de teste abaixo e os cadastros
 *         ficam salvos só neste navegador (localStorage). Serve para apresentar o protótipo.
 * false = usa a API real (API_URL).
 * ATENÇÃO: no modo demonstração as senhas ficam em texto puro no navegador. Nunca use em produção.
 */
const MODO_DEMO: boolean = true;

/** Conta usada no modo demonstração. */
interface ContaDemo {
  id: string;
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
  senha: string;
  perfil: PerfilUsuario;
}

/** Contas de teste que já existem no modo demonstração. */
const CONTAS_DEMO: ContaDemo[] = [
  { id: 'demo-admin', nome: 'Administrador FAB', email: 'admin@fab.com', cpf: '', telefone: '', senha: 'admin123', perfil: 'admin' },
  { id: 'demo-professor', nome: 'Professor Demonstração', email: 'professor@fab.com', cpf: '', telefone: '', senha: 'prof123', perfil: 'usuario' },
];

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

  // ---------- Autenticação e registo ----------

  /**
   * Faz o login. Se aceito, guarda o token e o perfil e devolve a resposta.
   * Se falhar (ex.: 401), o erro sobe para o componente exibir a mensagem.
   */
  login(credenciais: LoginCredenciaisDTO): Observable<AuthResponse> {
    const resposta$ = MODO_DEMO
      ? this.loginDemo(credenciais)
      : this.http
          .post<ApiResponse<AuthResponse>>(`${API_URL}/auth/login`, credenciais)
          .pipe(map((resposta) => resposta.dados)); // tira o "envelope" da API

    // Persiste token, perfil e nome
    return resposta$.pipe(tap((auth) => this.salvarSessao(auth.tokenAcesso, auth.usuario?.nome)));
  }

  /** Cria uma conta nova (não faz login). */
  cadastrar(dados: CadastroPayload): Observable<ApiResponse<unknown>> {
    if (MODO_DEMO) {
      return this.cadastrarDemo(dados);
    }
    return this.http.post<ApiResponse<unknown>>(`${API_URL}/auth/cadastro`, dados);
  }

  /**
   * Cria a conta e, se der certo, já faz o login com o mesmo e-mail e senha.
   * Assim o usuário entra direto no app depois do cadastro, sem passar pela tela de login.
   */
  cadastrarELogar(dados: CadastroPayload): Observable<AuthResponse> {
    return this.cadastrar(dados).pipe(
      // switchMap: só executa o login depois que o cadastro terminou com sucesso
      switchMap(() => this.login({ email: dados.email, senha: dados.senha })),
    );
  }

  /**
   * Rota para onde o usuário vai depois de entrar (login ou cadastro):
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

  /** Valida e-mail e senha nas contas de teste e nas contas cadastradas neste navegador. */
  private loginDemo(credenciais: LoginCredenciaisDTO): Observable<AuthResponse> {
    return defer(() => {
      const email = credenciais.email.trim().toLowerCase();
      const conta = this.contasDemo().find(
        (c) => c.email.toLowerCase() === email && c.senha === credenciais.senha,
      );

      if (!conta) {
        // Mesmo erro que a API devolveria para credenciais erradas
        return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }));
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
          status: 'ativo',
          criadoEm: new Date().toISOString(),
        },
      };
      return of(resposta).pipe(delay(400)); // pequena espera, como numa requisição de verdade
    });
  }

  /** Guarda a conta nova no navegador. Recusa e-mail ou CPF já usados (erro 409, como a API). */
  private cadastrarDemo(dados: CadastroPayload): Observable<ApiResponse<unknown>> {
    return defer(() => {
      const email = dados.email.trim().toLowerCase();
      const duplicada = this.contasDemo().some(
        (c) => c.email.toLowerCase() === email || (!!c.cpf && c.cpf === dados.cpf),
      );

      if (duplicada) {
        return throwError(() => new HttpErrorResponse({ status: 409, statusText: 'Conflict' }));
      }

      const nova: ContaDemo = {
        id: `demo-${Date.now()}`,
        nome: dados.nome.trim(),
        email: dados.email.trim(),
        cpf: dados.cpf,
        telefone: dados.telefone,
        senha: dados.senha,
        perfil: 'usuario', // quem se cadastra é usuário comum
      };
      this.escreverStorage(
        CHAVE_CONTAS_DEMO,
        JSON.stringify([...this.lerContasCadastradas(), nova]),
      );

      const resposta: ApiResponse<unknown> = {
        sucesso: true,
        mensagem: 'Conta criada (modo demonstração)',
        dados: null,
        timestamp: new Date().toISOString(),
      };
      return of(resposta).pipe(delay(400));
    });
  }

  /** Contas de teste + contas cadastradas neste navegador. */
  private contasDemo(): ContaDemo[] {
    return [...CONTAS_DEMO, ...this.lerContasCadastradas()];
  }

  private lerContasCadastradas(): ContaDemo[] {
    try {
      return JSON.parse(this.lerStorage(CHAVE_CONTAS_DEMO) ?? '[]') as ContaDemo[];
    } catch {
      return [];
    }
  }

  /** Monta um "JWT" de mentira (cabeçalho.dados.assinatura) só para o app ler o perfil. */
  private gerarTokenDemo(conta: ContaDemo): string {
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

  /** Apaga tudo que identifica o usuário logado. (As contas do modo demonstração são mantidas.) */
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