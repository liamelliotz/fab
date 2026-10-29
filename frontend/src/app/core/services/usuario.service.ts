import { Injectable, computed, effect, signal } from '@angular/core';
import { Resultado, falha, sucesso } from '../models/resultado.model';
import { CriarUsuarioDTO, PerfilUsuario, StatusUsuario, Usuario, UsuarioResumo } from '../models/usuario.model';
import { gravarJson, lerJson } from '../utils/armazenamento.utils';
import { somenteNumeros } from '../utils/validation.utils';

/**
 * Usuário da demonstração. A `senha` fica em texto SÓ aqui, porque não há backend: com a API
 * real ela some (o backend guarda apenas o hash e nunca devolve a senha).
 */
export interface UsuarioDemo extends Usuario {
  senha: string;
}

const CHAVE_USUARIOS = 'fab_demo_v3_usuarios';

/** Contas de exemplo. Os ids 'u1' a 'u4' são os mesmos dos pedidos de exemplo. Todos os CPFs são fictícios. */
export function criarUsuariosDemo(): UsuarioDemo[] {
  const base = { status: 'ativo' as StatusUsuario, criadoEm: '2026-08-01T10:00:00.000Z' };
  return [
    {
      ...base, id: 'demo-admin', nome: 'Administrador FAB', email: 'admin@fab.com', senha: 'admin123',
      cpf: '52998224725', telefone: '96991110001', departamento: 'Coordenação', perfil: 'admin',
    },
    {
      // Habilitado na Impressora 3D (id '8'): serve para mostrar o bloqueio por treinamento nas transferências.
      ...base, id: 'demo-professor', nome: 'Professor Demonstração', email: 'professor@fab.com', senha: 'prof123',
      cpf: '11144477735', telefone: '96991110002', departamento: 'Docência', perfil: 'usuario', habilitacoes: ['8'],
    },
    {
      ...base, id: 'u1', nome: 'João Silva', email: 'joao@escola.br', senha: 'prof123',
      cpf: '39053344705', telefone: '96991110003', departamento: 'Informática', perfil: 'usuario', habilitacoes: [],
    },
    {
      ...base, id: 'u2', nome: 'Maria Santos', email: 'maria@escola.br', senha: 'prof123',
      cpf: '16899535009', telefone: '96991110004', departamento: 'Secretaria', perfil: 'usuario', habilitacoes: [],
    },
    {
      ...base, id: 'u3', nome: 'Carlos Souza', email: 'carlos@escola.br', senha: 'prof123',
      cpf: '93541134780', telefone: '96991110005', departamento: 'Eletrônica', perfil: 'usuario', habilitacoes: [],
    },
    {
      ...base, id: 'u4', nome: 'Ana Lima', email: 'ana@escola.br', senha: 'prof123',
      cpf: '74685426002', telefone: '96991110006', departamento: 'Informática', perfil: 'usuario', habilitacoes: ['8'],
    },
  ];
}

/** Dados resumidos de uma conta de exemplo (usado pelos pedidos de exemplo). */
export function resumoDemo(id: string): UsuarioResumo {
  const u = criarUsuariosDemo().find((x) => x.id === id);
  if (!u) throw new Error(`Usuário de exemplo inexistente: ${id}`);
  return { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, departamento: u.departamento };
}

/** Dados do cadastro feito pelo administrador. */
export interface NovoUsuarioDemo extends CriarUsuarioDTO {
  telefone: string;
}

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  readonly todos = signal<UsuarioDemo[]>(lerJson<UsuarioDemo[]>(CHAVE_USUARIOS) ?? criarUsuariosDemo());

  /** Contas que podem entrar e receber pedidos ou transferências. */
  readonly ativos = computed(() => this.todos().filter((u) => u.status === 'ativo'));

  constructor() {
    effect(() => gravarJson(CHAVE_USUARIOS, this.todos()));
  }

  buscarPorId(id: string): UsuarioDemo | undefined {
    return this.todos().find((u) => u.id === id);
  }

  resumo(id: string): UsuarioResumo | undefined {
    const u = this.buscarPorId(id);
    return u && { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, departamento: u.departamento };
  }

  emailExiste(email: string): boolean {
    const alvo = email.trim().toLowerCase();
    return this.todos().some((u) => u.email.toLowerCase() === alvo);
  }

  cpfExiste(cpf: string): boolean {
    const alvo = somenteNumeros(cpf);
    return this.todos().some((u) => somenteNumeros(u.cpf) === alvo);
  }

  /** Cria uma conta (feita só pelo administrador). Falha se o e-mail ou o CPF já existirem. */
  criar(dados: NovoUsuarioDemo): Resultado<UsuarioDemo> {
    if (this.emailExiste(dados.email)) return falha('Já existe um usuário com este e-mail.');
    if (this.cpfExiste(dados.cpf)) return falha('Já existe um usuário com este CPF.');
    const novo: UsuarioDemo = {
      id: crypto.randomUUID(),
      nome: dados.nome.trim(),
      email: dados.email.trim().toLowerCase(),
      senha: dados.senha,
      cpf: somenteNumeros(dados.cpf),
      telefone: somenteNumeros(dados.telefone),
      matricula: dados.matricula?.trim() || undefined,
      departamento: dados.departamento?.trim() || undefined,
      perfil: dados.perfil ?? 'usuario',
      status: 'ativo',
      habilitacoes: dados.habilitacoes ?? [],
      criadoEm: new Date().toISOString(),
    };
    this.todos.update((lista) => [...lista, novo]);
    return sucesso(novo);
  }

  /** Ativa ou desativa a conta. */
  alternarStatus(id: string): void {
    this.alterar(id, (u) => ({ ...u, status: u.status === 'ativo' ? 'inativo' : 'ativo' }));
  }

  /** Troca entre administrador e usuário. */
  alterarPerfil(id: string, perfil: PerfilUsuario): void {
    this.alterar(id, (u) => ({ ...u, perfil }));
  }

  /** Concede ou retira a habilitação de um equipamento que exige treinamento. */
  definirHabilitacao(id: string, equipamentoId: string, habilitado: boolean): void {
    this.alterar(id, (u) => {
      const atuais = (u.habilitacoes ?? []).filter((e) => e !== equipamentoId);
      return { ...u, habilitacoes: habilitado ? [...atuais, equipamentoId] : atuais };
    });
  }

  habilitado(usuarioId: string, equipamentoId: string): boolean {
    return this.buscarPorId(usuarioId)?.habilitacoes?.includes(equipamentoId) ?? false;
  }

  /**
   * Confere e-mail e senha (modo demonstração). Distingue conta desativada de credencial errada
   * para o login poder avisar a pessoa certa.
   */
  autenticar(email: string, senha: string): { usuario?: UsuarioDemo; erro?: 'credenciais' | 'inativo' } {
    const alvo = email.trim().toLowerCase();
    const usuario = this.todos().find((u) => u.email.toLowerCase() === alvo && u.senha === senha);
    if (!usuario) return { erro: 'credenciais' };
    if (usuario.status !== 'ativo') return { erro: 'inativo' };
    return { usuario };
  }

  /** Volta as contas ao estado inicial da demonstração. */
  reiniciar(): void {
    this.todos.set(criarUsuariosDemo());
  }

  private alterar(id: string, fn: (u: UsuarioDemo) => UsuarioDemo): void {
    this.todos.update((lista) => lista.map((u) => (u.id === id ? fn(u) : u)));
  }
}
