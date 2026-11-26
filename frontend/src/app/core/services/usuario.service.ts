import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, defer, of } from 'rxjs';
import { ENDPOINTS } from '../constants/api.constants';
import { RespostaPaginada } from '../models/pagination.model';
import {
  AtualizarUsuarioDTO,
  CriarUsuarioDTO,
  PerfilUsuario,
  StatusUsuario,
  Usuario,
  UsuarioResumo,
} from '../models/usuario.model';
import { gravarJson, lerJson, ouvirOutrasAbas, removerChave } from '../utils/armazenamento.utils';
import { somenteNumeros } from '../utils/validation.utils';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';

/**
 * USUÁRIOS (card A7)
 * ==============================================================================================
 * Com a API (modoDemo false, `npm start`): tudo passa por /usuarios e /auth/me. Nada de conta,
 * e muito menos senha, fica guardado no navegador.
 *
 * Na demonstração (`npm run demo`): os mesmos métodos funcionam com os dados deste navegador,
 * para a apresentação continuar rodando sem servidor. Isso some no card E7.
 * ==============================================================================================
 */

/** Filtros e paginação do GET /usuarios. */
export interface FiltroUsuarios {
  busca?: string;
  perfil?: PerfilUsuario;
  status?: StatusUsuario;
  pagina?: number;
  itensPorPagina?: number;
}

/** Item do GET /usuarios/resumo: colegas ativos, sem CPF, e-mail ou telefone. */
export interface ColegaResumo {
  id: string;
  nome: string;
  departamento?: string;
  habilitacoes: string[];
}

const CHAVE_USUARIOS = 'fab_demo_v7_usuarios';
/** Senhas da demonstração. Ficam separadas das contas e só existem no `npm run demo`. */
const CHAVE_SENHAS = 'fab_demo_v7_senhas';

/** Senhas das contas de exemplo (só para a demonstração, por e-mail). */
const SENHAS_DEMO: Record<string, string> = {
  'admin@fab.com': 'admin123',
  'professor@fab.com': 'prof123',
  'joao@escola.br': 'prof123',
  'maria@escola.br': 'prof123',
  'carlos@escola.br': 'prof123',
  'ana@escola.br': 'prof123',
};

/**
 * Contas de exemplo. Os ids são os mesmos do seed da API (usr-admin, usr-professor, usr-joao...):
 * assim, quem entra pelo login real continua vendo os pedidos de exemplo. Todos os CPFs são fictícios.
 */
export function criarUsuariosDemo(): Usuario[] {
  const base = { status: 'ativo' as StatusUsuario, criadoEm: '2026-08-01T10:00:00.000Z' };
  return [
    {
      ...base, id: 'usr-admin', nome: 'Administrador FAB', email: 'admin@fab.com',
      cpf: '52998224725', telefone: '96991110001', departamento: 'Coordenação', perfil: 'admin',
    },
    {
      // Habilitado na Impressora 3D (id '8'): serve para mostrar o bloqueio por treinamento nas transferências.
      ...base, id: 'usr-professor', nome: 'Pedro Almeida', email: 'professor@fab.com',
      cpf: '11144477735', telefone: '96991110002', departamento: 'Docência', perfil: 'usuario', habilitacoes: ['8'],
    },
    {
      ...base, id: 'usr-joao', nome: 'João Silva', email: 'joao@escola.br',
      cpf: '39053344705', telefone: '96991110003', departamento: 'Informática', perfil: 'usuario', habilitacoes: [],
    },
    {
      ...base, id: 'usr-maria', nome: 'Maria Santos', email: 'maria@escola.br',
      cpf: '16899535009', telefone: '96991110004', departamento: 'Secretaria', perfil: 'usuario', habilitacoes: [],
    },
    {
      ...base, id: 'usr-carlos', nome: 'Carlos Souza', email: 'carlos@escola.br',
      cpf: '93541134780', telefone: '96991110005', departamento: 'Eletrônica', perfil: 'usuario', habilitacoes: [],
    },
    {
      ...base, id: 'usr-ana', nome: 'Ana Lima', email: 'ana@escola.br',
      cpf: '74685426002', telefone: '96991110006', departamento: 'Informática', perfil: 'usuario', habilitacoes: ['8'],
    },
  ];
}

/**
 * Dados resumidos de uma conta de exemplo (usado pelos pedidos de exemplo).
 * @deprecated Só para os dados de exemplo dos empréstimos. Sai no C8, quando os pedidos vierem da API.
 */
export function resumoDemo(id: string): UsuarioResumo {
  const u = criarUsuariosDemo().find((x) => x.id === id);
  if (!u) throw new Error(`Usuário de exemplo inexistente: ${id}`);
  return { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, departamento: u.departamento };
}

/** Erro no mesmo formato da API, para a tela tratar igual nos dois modos. */
function erroComoApi(status: number, mensagem: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { sucesso: false, mensagem, erros: [] } });
}

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly api = inject(ApiService);

  /** true no `npm run demo`: os métodos usam os dados deste navegador em vez da API. */
  readonly modoDemo = environment.modoDemo;

  /**
   * Contas guardadas no navegador.
   * @deprecated Só existe para a demonstração e para os empréstimos de exemplo (até o C8).
   * Telas novas devem usar `listar()`.
   */
  readonly todos = signal<Usuario[]>(
    (this.modoDemo ? lerJson<Usuario[]>(CHAVE_USUARIOS) : null) ?? criarUsuariosDemo(),
  );
  private readonly senhas = signal<Record<string, string>>(
    this.modoDemo ? (lerJson<Record<string, string>>(CHAVE_SENHAS) ?? { ...SENHAS_DEMO }) : {},
  );

  /**
   * Contas que podem entrar e receber pedidos ou transferências.
   * @deprecated Use `listarColegas()` (GET /usuarios/resumo). Fica até o C8.
   */
  readonly ativos = computed(() => this.todos().filter((u) => u.status === 'ativo'));

  constructor() {
    if (!this.modoDemo) {
      // Com a API, contas e senhas não ficam no navegador (apaga o que sobrou de uma demonstração).
      removerChave(CHAVE_USUARIOS);
      removerChave(CHAVE_SENHAS);
      return;
    }
    effect(() => gravarJson(CHAVE_USUARIOS, this.todos()));
    effect(() => gravarJson(CHAVE_SENHAS, this.senhas()));
    ouvirOutrasAbas<Usuario[]>(CHAVE_USUARIOS, (v) => v && this.todos.set(v));
    ouvirOutrasAbas<Record<string, string>>(CHAVE_SENHAS, (v) => v && this.senhas.set(v));
  }

  // ============================== API (card A7) ==============================

  /** GET /usuarios: lista paginada, com busca por nome, e-mail ou departamento. */
  listar(filtros: FiltroUsuarios = {}): Observable<RespostaPaginada<Usuario>> {
    if (!this.modoDemo) return this.api.get(ENDPOINTS.usuarios.base, filtros);
    return defer(() => {
      const termo = filtros.busca?.trim().toLowerCase() ?? '';
      const itens = this.todos().filter(
        (u) =>
          (!termo ||
            u.nome.toLowerCase().includes(termo) ||
            u.email.toLowerCase().includes(termo) ||
            (u.departamento ?? '').toLowerCase().includes(termo)) &&
          (!filtros.perfil || u.perfil === filtros.perfil) &&
          (!filtros.status || u.status === filtros.status),
      );
      const pagina = Math.max(1, filtros.pagina ?? 1);
      const tamanho = Math.min(100, Math.max(1, filtros.itensPorPagina ?? 10));
      const totalPaginas = Math.ceil(itens.length / tamanho);
      return of({
        itens: itens.slice((pagina - 1) * tamanho, pagina * tamanho),
        totalItens: itens.length,
        paginaAtual: pagina,
        totalPaginas,
        itensPorPagina: tamanho,
        temProxima: pagina < totalPaginas,
        temAnterior: pagina > 1,
      });
    });
  }

  /** GET /usuarios/resumo: colegas ativos, para transferências. */
  listarColegas(busca?: string): Observable<ColegaResumo[]> {
    if (!this.modoDemo) return this.api.get(ENDPOINTS.usuarios.resumo, { busca });
    return defer(() =>
      of(
        this.ativos()
          .filter((u) => !busca || u.nome.toLowerCase().includes(busca.trim().toLowerCase()))
          .map((u) => ({ id: u.id, nome: u.nome, departamento: u.departamento, habilitacoes: u.habilitacoes ?? [] })),
      ),
    );
  }

  /** GET /auth/me: a conta de quem está logado. */
  minhaConta(idDoToken: string): Observable<Usuario> {
    if (!this.modoDemo) return this.api.get(ENDPOINTS.auth.me);
    return defer(() => {
      const u = this.buscarPorId(idDoToken);
      if (!u) throw erroComoApi(404, 'Usuário não encontrado.');
      return of(u);
    });
  }

  /** POST /usuarios: só o administrador cria contas. E-mail ou CPF repetido dá 409. */
  criar(dto: CriarUsuarioDTO): Observable<Usuario> {
    const corpo: CriarUsuarioDTO = {
      ...dto,
      nome: dto.nome.trim(),
      email: dto.email.trim().toLowerCase(),
      cpf: somenteNumeros(dto.cpf),
      telefone: dto.telefone ? somenteNumeros(dto.telefone) : undefined,
      matricula: dto.matricula?.trim() || undefined,
      departamento: dto.departamento?.trim() || undefined,
    };
    if (!this.modoDemo) return this.api.post(ENDPOINTS.usuarios.base, corpo);
    return defer(() => {
      if (this.todos().some((u) => u.email.toLowerCase() === corpo.email)) {
        throw erroComoApi(409, 'Já existe um usuário com este e-mail.');
      }
      if (this.todos().some((u) => somenteNumeros(u.cpf) === corpo.cpf)) {
        throw erroComoApi(409, 'Já existe um usuário com este CPF.');
      }
      const { senha, ...dados } = corpo;
      const novo: Usuario = {
        ...dados,
        id: crypto.randomUUID(),
        perfil: corpo.perfil ?? 'usuario',
        status: 'ativo',
        habilitacoes: corpo.habilitacoes ?? [],
        criadoEm: new Date().toISOString(),
      };
      this.todos.update((lista) => [...lista, novo]);
      this.senhas.update((atual) => ({ ...atual, [novo.email]: senha }));
      return of(novo);
    });
  }

  /** PATCH /usuarios/:id: nome, telefone, matrícula, departamento e perfil. */
  editar(id: string, dto: AtualizarUsuarioDTO, quemEsta?: string): Observable<Usuario> {
    if (!this.modoDemo) return this.api.patch(ENDPOINTS.usuarios.porId(id), dto);
    return defer(() => {
      const alvo = this.exigir(id);
      if (dto.perfil && dto.perfil !== 'admin' && alvo.perfil === 'admin') {
        if (id === quemEsta) throw erroComoApi(409, 'Você não pode rebaixar o seu próprio perfil de administrador.');
        this.exigirOutroAdmin(id);
      }
      return of(this.alterar(id, (u) => ({ ...u, ...dto })));
    });
  }

  /** PATCH /usuarios/:id/status: ativo, inativo ou bloqueado (com as travas do admin). */
  alterarStatus(id: string, status: StatusUsuario, quemEsta?: string): Observable<Usuario> {
    if (!this.modoDemo) return this.api.patch(ENDPOINTS.usuarios.status(id), { status });
    return defer(() => {
      const alvo = this.exigir(id);
      if (id === quemEsta) throw erroComoApi(409, 'Você não pode alterar o status da sua própria conta.');
      if (alvo.perfil === 'admin' && status !== 'ativo') this.exigirOutroAdmin(id);
      return of(this.alterar(id, (u) => ({ ...u, status })));
    });
  }

  /** PUT /usuarios/:id/habilitacoes: substitui a lista inteira de equipamentos habilitados. */
  definirHabilitacoes(id: string, equipamentoIds: string[]): Observable<Usuario> {
    if (!this.modoDemo) return this.api.put(ENDPOINTS.usuarios.habilitacoes(id), { equipamentoIds });
    return defer(() => {
      this.exigir(id);
      return of(this.alterar(id, (u) => ({ ...u, habilitacoes: [...new Set(equipamentoIds)] })));
    });
  }

  // ===================== Demonstração e empréstimos de exemplo =====================

  /** @deprecated Dados locais. Telas novas: `listar()` ou `minhaConta()`. Fica até o C8. */
  buscarPorId(id: string): Usuario | undefined {
    return this.todos().find((u) => u.id === id);
  }

  /** @deprecated Usado pelos empréstimos de exemplo. Sai no C8. */
  resumo(id: string): UsuarioResumo | undefined {
    const u = this.buscarPorId(id);
    return u && { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, departamento: u.departamento };
  }

  /** @deprecated Os empréstimos de exemplo ainda conferem a habilitação aqui. Sai no C8. */
  habilitado(usuarioId: string, equipamentoId: string): boolean {
    return this.buscarPorId(usuarioId)?.habilitacoes?.includes(equipamentoId) ?? false;
  }

  /**
   * Confere e-mail e senha (só no modo demonstração). Distingue conta desativada de credencial
   * errada para o login poder avisar a pessoa certa.
   */
  autenticar(email: string, senha: string): { usuario?: Usuario; erro?: 'credenciais' | 'inativo' } {
    const alvo = email.trim().toLowerCase();
    const usuario = this.todos().find((u) => u.email.toLowerCase() === alvo);
    if (!this.modoDemo || !usuario || this.senhas()[usuario.email] !== senha) return { erro: 'credenciais' };
    if (usuario.status !== 'ativo') return { erro: 'inativo' };
    return { usuario };
  }

  /** Volta as contas ao estado inicial da demonstração. */
  reiniciar(): void {
    this.todos.set(criarUsuariosDemo());
    this.senhas.set({ ...SENHAS_DEMO });
  }

  private exigir(id: string): Usuario {
    const u = this.buscarPorId(id);
    if (!u) throw erroComoApi(404, 'Usuário não encontrado.');
    return u;
  }

  /** Mesma trava da API: sempre resta pelo menos um administrador ativo. */
  private exigirOutroAdmin(id: string): void {
    const outros = this.todos().filter((u) => u.id !== id && u.perfil === 'admin' && u.status === 'ativo');
    if (outros.length === 0) throw erroComoApi(409, 'É preciso manter pelo menos um administrador ativo.');
  }

  private alterar(id: string, fn: (u: Usuario) => Usuario): Usuario {
    let alterado!: Usuario;
    this.todos.update((lista) =>
      lista.map((u) => {
        if (u.id !== id) return u;
        alterado = fn(u);
        return alterado;
      }),
    );
    return alterado;
  }
}
