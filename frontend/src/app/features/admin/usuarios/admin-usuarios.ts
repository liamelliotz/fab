import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Equipamento } from '../../../core/models/equipamento.model';
import { PerfilUsuario } from '../../../core/models/usuario.model';
import { AuthService } from '../../../core/services/auth.service';
import { EquipamentoService } from '../../../core/services/equipamento.service';
import { NotificationService } from '../../../core/services/notification.service';
import { UsuarioDemo, UsuarioService } from '../../../core/services/usuario.service';
import { gerarCodigo } from '../../../core/utils/codigo.utils';
import {
  cpfValido,
  formatarCpf,
  formatarTelefone,
  telefoneValido,
} from '../../../core/utils/validation.utils';

type Campo = 'nome' | 'email' | 'cpf' | 'telefone' | 'senha';

/**
 * Gestão de usuários (só administrador). É aqui que as contas são criadas: o cadastro
 * deixou de ser público. O administrador também define o perfil, ativa/desativa contas e
 * concede as habilitações (treinamentos) exigidas por alguns equipamentos.
 */
@Component({
  selector: 'app-admin-usuarios',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './admin-usuarios.html',
  styleUrl: './admin-usuarios.css',
})
export class AdminUsuarios {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly service = inject(UsuarioService);
  private readonly equipamentos = inject(EquipamentoService);
  private readonly auth = inject(AuthService);
  private readonly notificacoes = inject(NotificationService);

  readonly busca = signal('');
  readonly formAberto = signal(false);
  readonly erroForm = signal('');
  /** Dados da conta recém-criada, para o administrador repassar à pessoa. */
  readonly credencial = signal<{ nome: string; email: string; senha: string } | null>(null);
  /** Usuário cujas habilitações estão sendo editadas. */
  readonly habilitandoId = signal<string | null>(null);

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

  readonly todos = this.service.todos;

  readonly filtrados = computed(() => {
    const termo = this.busca().trim().toLowerCase();
    return this.todos().filter(
      (u) =>
        !termo ||
        u.nome.toLowerCase().includes(termo) ||
        u.email.toLowerCase().includes(termo) ||
        (u.departamento ?? '').toLowerCase().includes(termo),
    );
  });

  readonly totalUsuarios = computed(() => this.todos().length);
  readonly totalAdmins = computed(() => this.todos().filter((u) => u.perfil === 'admin').length);
  readonly totalProfessores = computed(() => this.todos().filter((u) => u.perfil === 'usuario').length);

  /** Equipamentos que exigem treinamento (os únicos que têm habilitação). */
  readonly treinaveis = computed<Equipamento[]>(() =>
    this.equipamentos.itens().filter((e) => e.requerTreinamento && e.status !== 'descartado'),
  );

  readonly habilitando = computed<UsuarioDemo | null>(() => {
    const id = this.habilitandoId();
    return id ? (this.service.buscarPorId(id) ?? null) : null;
  });

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
  }

  // ---- Tabela ----
  atualizarBusca(evento: Event): void {
    this.busca.set((evento.target as HTMLInputElement).value);
  }

  ehEu(u: UsuarioDemo): boolean {
    return u.id === this.auth.usuarioAtual().id;
  }

  nomePerfil(perfil: PerfilUsuario): string {
    return perfil === 'admin' ? 'Administrador' : 'Professor';
  }

  nomeStatus(status: string): string {
    return status === 'ativo' ? 'Ativo' : status === 'bloqueado' ? 'Bloqueado' : 'Inativo';
  }

  /** "Impressora 3D Creality Ender 3 V2, Osciloscópio..." ou "—". */
  habilitacoes(u: UsuarioDemo): string {
    const nomes = (u.habilitacoes ?? [])
      .map((id) => this.equipamentos.buscarPorId(id)?.nome)
      .filter((n): n is string => !!n);
    return nomes.length > 0 ? nomes.join(', ') : '—';
  }

  alternarStatus(u: UsuarioDemo): void {
    if (this.ehEu(u)) {
      this.notificacoes.erro('Você não pode desativar a sua própria conta.');
      return;
    }
    this.service.alternarStatus(u.id);
    this.notificacoes.info(
      u.status === 'ativo' ? `${u.nome} foi desativado e não consegue mais entrar.` : `${u.nome} foi reativado.`,
    );
  }

  alterarPerfil(u: UsuarioDemo): void {
    if (this.ehEu(u)) {
      this.notificacoes.erro('Você não pode mudar o seu próprio perfil.');
      return;
    }
    this.service.alterarPerfil(u.id, u.perfil === 'admin' ? 'usuario' : 'admin');
  }

  // ---- Novo usuário ----
  alternarForm(): void {
    this.formAberto.update((aberto) => !aberto);
    this.erroForm.set('');
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
    this.erroForm.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const resultado = this.service.criar({
      nome: v.nome,
      email: v.email,
      cpf: v.cpf,
      telefone: v.telefone,
      senha: v.senha,
      departamento: v.departamento,
      matricula: v.matricula,
      perfil: v.perfil,
    });
    if (!resultado.ok) {
      this.erroForm.set(resultado.erro);
      return;
    }
    const criado = resultado.valor;
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
  }

  fecharCredencial(): void {
    this.credencial.set(null);
  }

  // ---- Habilitações ----
  abrirHabilitacoes(u: UsuarioDemo): void {
    this.habilitandoId.set(u.id);
  }

  fecharHabilitacoes(): void {
    this.habilitandoId.set(null);
  }

  habilitadoEm(u: UsuarioDemo, e: Equipamento): boolean {
    return this.service.habilitado(u.id, e.id);
  }

  alternarHabilitacao(u: UsuarioDemo, e: Equipamento, evento: Event): void {
    this.service.definirHabilitacao(u.id, e.id, (evento.target as HTMLInputElement).checked);
  }
}
