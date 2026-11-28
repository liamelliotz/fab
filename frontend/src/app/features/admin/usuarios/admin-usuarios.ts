import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, finalize, forkJoin, map, of } from 'rxjs';
import { ENDPOINTS } from '../../../core/constants/api.constants';
import { Equipamento } from '../../../core/models/equipamento.model';
import { RespostaPaginada } from '../../../core/models/pagination.model';
import { PerfilUsuario, StatusUsuario, Usuario } from '../../../core/models/usuario.model';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { EquipamentoService } from '../../../core/services/equipamento.service';
import { NotificationService } from '../../../core/services/notification.service';
import { UsuarioService } from '../../../core/services/usuario.service';
import { RegrasEmprestimoService } from '../../../core/services/regras-emprestimo.service';
import { formatarData, hojeISO } from '../../../core/utils/date.utils';
import { gerarCodigo } from '../../../core/utils/codigo.utils';
import {
  cpfValido,
  formatarCpf,
  formatarTelefone,
  telefoneValido,
} from '../../../core/utils/validation.utils';
import { DialogoDirective } from '../../../shared/directives/dialogo.directive';

type Campo = 'nome' | 'email' | 'cpf' | 'telefone' | 'senha';

/** Quantos usuários por página na tabela. */
const POR_PAGINA = 10;

/**
 * Gestão de usuários (só administrador). É aqui que as contas são criadas: o cadastro
 * deixou de ser público. O administrador também define o perfil, ativa, desativa ou bloqueia
 * contas e concede as habilitações (treinamentos) exigidas por alguns equipamentos.
 *
 * Desde o card A7 tudo passa pela API (/usuarios): a busca e a paginação são feitas no servidor.
 * Erros 400 e 409 da API aparecem pelo serviço de notificações (error.interceptor).
 */
@Component({
  selector: 'app-admin-usuarios',
  standalone: true,
  imports: [ReactiveFormsModule, DialogoDirective],
  templateUrl: './admin-usuarios.html',
  styleUrl: './admin-usuarios.css',
})
export class AdminUsuarios {
  private readonly fb = inject(FormBuilder).nonNullable;
  readonly service = inject(UsuarioService);
  private readonly api = inject(ApiService);
  private readonly equipamentosDemo = inject(EquipamentoService);
  private readonly auth = inject(AuthService);
  private readonly notificacoes = inject(NotificationService);
  private readonly destroy = inject(DestroyRef);
  private readonly regras = inject(RegrasEmprestimoService);
  private esperaBusca?: ReturnType<typeof setTimeout>;

  readonly busca = signal('');
  readonly pagina = signal(1);
  readonly resposta = signal<RespostaPaginada<Usuario> | null>(null);
  readonly carregando = signal(false);
  readonly salvando = signal(false);
  readonly totais = signal({ usuarios: 0, admins: 0, professores: 0 });

  readonly formAberto = signal(false);
  /** Dados da conta recém-criada, para o administrador repassar à pessoa. */
  readonly credencial = signal<{ nome: string; email: string; senha: string } | null>(null);
  /** Usuário cujas habilitações estão sendo editadas e a seleção atual (ids de equipamentos). */
  readonly habilitando = signal<Usuario | null>(null);
  readonly selecao = signal<string[]>([]);

  /** Equipamentos que exigem treinamento (os únicos que têm habilitação). */
  readonly treinaveis = signal<Equipamento[]>([]);

  readonly form = this.fb.group({
    nome: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    cpf: ['', [Validators.required, cpfValido]],
    telefone: ['', [Validators.required, telefoneValido]],
    departamento: [''],
    matricula: [''],
    perfil: ['usuario' as PerfilUsuario],
    senha: [gerarCodigo(8), [Validators.required, Validators.minLength(8)]],
  });

  readonly usuarios = computed(() => this.resposta()?.itens ?? []);

  constructor() {
    // Máscaras enquanto digita (emitEvent: false evita laço infinito)
    this.form.controls.cpf.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => {
      const formatado = formatarCpf(v);
      if (formatado !== v) this.form.controls.cpf.setValue(formatado, { emitEvent: false });
    });
    this.form.controls.telefone.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => {
      const formatado = formatarTelefone(v);
      if (formatado !== v) this.form.controls.telefone.setValue(formatado, { emitEvent: false });
    });
    this.destroy.onDestroy(() => clearTimeout(this.esperaBusca));
    this.carregarEquipamentos();
    this.recarregar();
  }

  // ---- Lista (GET /usuarios) ----

  /** Busca a página atual e os totais dos cartões. */
  recarregar(): void {
    this.carregando.set(true);
    this.service
      .listar({ busca: this.busca().trim() || undefined, pagina: this.pagina(), itensPorPagina: POR_PAGINA })
      .pipe(
        takeUntilDestroyed(this.destroy),
        finalize(() => this.carregando.set(false)),
      )
      .subscribe({
        next: (r) => {
          // A página ficou vazia (ex.: a busca encolheu a lista): volta uma página
          if (r.itens.length === 0 && r.paginaAtual > 1) {
            this.pagina.set(r.paginaAtual - 1);
            this.recarregar();
            return;
          }
          this.resposta.set(r);
        },
        error: (erro) => this.avisarErroDemo(erro),
      });
    this.carregarTotais();
  }

  /** Digitou na busca: espera 300 ms sem digitar e volta para a página 1. */
  atualizarBusca(evento: Event): void {
    this.busca.set((evento.target as HTMLInputElement).value);
    clearTimeout(this.esperaBusca);
    this.esperaBusca = setTimeout(() => {
      this.pagina.set(1);
      this.recarregar();
    }, 300);
  }

  mudarPagina(delta: number): void {
    this.pagina.update((p) => Math.max(1, p + delta));
    this.recarregar();
  }

  private carregarTotais(): void {
    const contar = (perfil?: PerfilUsuario) =>
      this.service.listar({ perfil, itensPorPagina: 1 }).pipe(map((r) => r.totalItens));
    forkJoin({ usuarios: contar(), admins: contar('admin'), professores: contar('usuario') })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: (t) => this.totais.set(t), error: () => undefined });
  }

  /** Com a API, os equipamentos vêm de GET /equipamentos (ids da API). Na demonstração, do navegador. */
  private carregarEquipamentos(): void {
    const fonte: Observable<Equipamento[]> = this.service.modoDemo
      ? of(this.equipamentosDemo.itens())
      : this.api
          .get<RespostaPaginada<Equipamento>>(ENDPOINTS.equipamentos.base, { itensPorPagina: 100 })
          .pipe(map((r) => r.itens));
    fonte.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (lista) => this.treinaveis.set(lista.filter((e) => e.requerTreinamento && e.status !== 'descartado')),
      error: () => this.treinaveis.set([]),
    });
  }

  ehEu(u: Usuario): boolean {
    return u.id === this.auth.usuarioAtual().id;
  }

  nomePerfil(perfil: PerfilUsuario): string {
    return perfil === 'admin' ? 'Administrador' : 'Professor';
  }

  nomeStatus(status: string): string {
    return status === 'ativo' ? 'Ativo' : status === 'bloqueado' ? 'Bloqueado' : 'Inativo';
  }

  /** "Impressora 3D Creality Ender 3 V2, Osciloscópio..." ou "—". */
  habilitacoes(u: Usuario): string {
    const nomes = (u.habilitacoes ?? [])
      .map((id) => this.treinaveis().find((e) => e.id === id)?.nome)
      .filter((n): n is string => !!n);
    return nomes.length > 0 ? nomes.join(', ') : '—';
  }

  // ---- Suspensão por atraso (regras de empréstimo) ----

  readonly data = formatarData;
  /** Encerrar a suspensão antes do prazo: na demonstração já funciona; com a API, depende da rota do contrato. */
  readonly podeEncerrarSuspensao = this.service.modoDemo;

  /** Dia em que termina a suspensão em vigor, ou null. */
  suspensaoAte(u: Usuario): string | null {
    return u.suspensaoAte && u.suspensaoAte >= hojeISO() ? u.suspensaoAte : null;
  }

  encerrarSuspensao(u: Usuario): void {
    const ate = this.suspensaoAte(u);
    if (!ate) return;
    this.service.encerrarSuspensao(u.id);
    this.regras.registrar(`Suspensão de ${u.nome} (até ${formatarData(ate)}) encerrada antes do prazo pela coordenação`);
    this.notificacoes.sucesso(`${u.nome} pode fazer pedidos de novo.`);
    this.recarregar();
  }

  // ---- Status e perfil (PATCH) ----

  mudarStatus(u: Usuario, status: StatusUsuario): void {
    const textos: Record<StatusUsuario, string> = {
      ativo: `${u.nome} foi reativado.`,
      inativo: `${u.nome} foi desativado e não consegue mais entrar.`,
      bloqueado: `${u.nome} foi bloqueado e perdeu o acesso na hora.`,
    };
    this.executar(this.service.alterarStatus(u.id, status, this.auth.usuarioAtual().id), textos[status]);
  }

  alterarPerfil(u: Usuario): void {
    const novo: PerfilUsuario = u.perfil === 'admin' ? 'usuario' : 'admin';
    this.executar(
      this.service.editar(u.id, { perfil: novo }, this.auth.usuarioAtual().id),
      `${u.nome} agora é ${novo === 'admin' ? 'administrador' : 'professor'}.`,
    );
  }

  // ---- Novo usuário (POST /usuarios) ----
  alternarForm(): void {
    this.formAberto.update((aberto) => !aberto);
  }

  gerarSenha(): void {
    this.form.controls.senha.setValue(gerarCodigo(8));
  }

  getError(campo: Campo): string {
    const c = this.form.controls[campo];
    if (!c.touched || c.valid) return '';
    if (c.hasError('required')) {
      const obrigatorios: Record<Campo, string> = {
        nome: 'Informe o nome completo.',
        email: 'Informe o e-mail.',
        cpf: 'Informe o CPF.',
        telefone: 'Informe o telefone.',
        senha: 'Defina uma senha provisória.',
      };
      return obrigatorios[campo];
    }
    if (c.hasError('minlength')) {
      return campo === 'nome' ? 'O nome deve ter ao menos 3 caracteres.' : 'A senha deve ter ao menos 8 caracteres.';
    }
    if (c.hasError('email')) return 'E-mail inválido.';
    if (c.hasError('cpfInvalido')) return 'CPF inválido.';
    if (c.hasError('telefoneInvalido')) return 'Telefone inválido (use DDD + número).';
    return '';
  }

  criar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.salvando()) return;
    const v = this.form.getRawValue();
    this.salvando.set(true);
    this.service
      .criar({
        nome: v.nome,
        email: v.email,
        cpf: v.cpf,
        telefone: v.telefone,
        senha: v.senha,
        departamento: v.departamento,
        matricula: v.matricula,
        perfil: v.perfil,
      })
      .pipe(
        takeUntilDestroyed(this.destroy),
        finalize(() => this.salvando.set(false)),
      )
      .subscribe({
        next: (criado) => {
          this.credencial.set({ nome: criado.nome, email: criado.email, senha: v.senha });
          this.notificacoes.sucesso(`Conta de ${criado.nome} criada.`);
          this.form.reset({
            nome: '',
            email: '',
            cpf: '',
            telefone: '',
            departamento: '',
            matricula: '',
            perfil: 'usuario',
            senha: gerarCodigo(8),
          });
          this.formAberto.set(false);
          this.recarregar();
        },
        // O formulário continua aberto para corrigir (ex.: 409 e-mail ou CPF já cadastrado).
        error: (erro) => this.avisarErroDemo(erro),
      });
  }

  fecharCredencial(): void {
    this.credencial.set(null);
  }

  // ---- Habilitações (PUT /usuarios/:id/habilitacoes) ----
  abrirHabilitacoes(u: Usuario): void {
    this.habilitando.set(u);
    this.selecao.set([...(u.habilitacoes ?? [])]);
  }

  fecharHabilitacoes(): void {
    this.habilitando.set(null);
  }

  habilitadoEm(e: Equipamento): boolean {
    return this.selecao().includes(e.id);
  }

  alternarHabilitacao(e: Equipamento, evento: Event): void {
    const marcado = (evento.target as HTMLInputElement).checked;
    this.selecao.update((atual) => (marcado ? [...atual, e.id] : atual.filter((id) => id !== e.id)));
  }

  salvarHabilitacoes(): void {
    const u = this.habilitando();
    if (!u) return;
    this.executar(
      this.service.definirHabilitacoes(u.id, this.selecao()),
      `Habilitações de ${u.nome} atualizadas.`,
      () => this.fecharHabilitacoes(),
    );
  }

  // ---- Apoio ----

  /** Roda uma alteração, avisa o resultado e recarrega a lista. */
  private executar(operacao: Observable<Usuario>, sucesso: string, depois?: () => void): void {
    if (this.salvando()) return;
    this.salvando.set(true);
    operacao
      .pipe(
        takeUntilDestroyed(this.destroy),
        finalize(() => this.salvando.set(false)),
      )
      .subscribe({
        next: () => {
          this.notificacoes.info(sucesso);
          depois?.();
          this.recarregar();
        },
        error: (erro) => this.avisarErroDemo(erro),
      });
  }

  /**
   * Com a API, o error.interceptor já mostrou o erro nas notificações.
   * Na demonstração não há HTTP, então a própria tela avisa (mesma mensagem da API).
   */
  private avisarErroDemo(erro: unknown): void {
    if (!this.service.modoDemo) return;
    const mensagem = (erro as HttpErrorResponse)?.error?.mensagem;
    this.notificacoes.erro(typeof mensagem === 'string' ? mensagem : 'Não foi possível concluir a operação.');
  }
}
