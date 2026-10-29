import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { EmprestimoService } from '../../../core/services/emprestimo.service';
import { EquipamentoService } from '../../../core/services/equipamento.service';
import { UsuarioService } from '../../../core/services/usuario.service';
import { formatarData, hojeISO } from '../../../core/utils/date.utils';

@Component({
  selector: 'app-emprestimo-solicitar',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './emprestimo-solicitar.html',
  styleUrl: './emprestimo-solicitar.css',
})
export class EmprestimoSolicitar {
  private readonly equipamentos = inject(EquipamentoService);
  private readonly emprestimos = inject(EmprestimoService);
  private readonly auth = inject(AuthService);
  private readonly usuarios = inject(UsuarioService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder).nonNullable;

  readonly hoje = hojeISO();
  readonly erro = signal('');

  readonly form = this.fb.group({
    equipamentoId: ['', Validators.required],
    quantidade: [1, [Validators.required, Validators.min(1)]],
    dataPrevistaRetirada: [hojeISO(), Validators.required],
    dataPrevistaDevolucao: ['', Validators.required],
    justificativa: ['', [Validators.required, Validators.minLength(10)]],
  });

  /** Só aparecem itens com unidades livres. */
  readonly disponiveis = computed(() =>
    this.equipamentos
      .catalogo()
      .filter((e) => e.status === 'disponivel' && e.quantidadeDisponivel > 0),
  );

  private readonly idSelecionado = toSignal(this.form.controls.equipamentoId.valueChanges, {
    initialValue: '',
  });

  readonly selecionado = computed(() => this.equipamentos.buscarPorId(this.idSelecionado()));

  private readonly retirada = toSignal(this.form.controls.dataPrevistaRetirada.valueChanges, {
    initialValue: hojeISO(),
  });

  /** Última data de devolução permitida para o material escolhido (prazo máximo de empréstimo). */
  readonly dataLimite = computed(() => {
    const item = this.selecionado();
    return item ? this.emprestimos.dataLimiteDevolucao(this.retirada(), item.id) : null;
  });
  readonly dataLimiteTexto = computed(() => formatarData(this.dataLimite()));

  /** O material exige treinamento e a pessoa ainda não foi habilitada pela coordenação. */
  readonly semHabilitacao = computed(() => {
    const item = this.selecionado();
    return !!item && item.requerTreinamento && !this.usuarios.habilitado(this.auth.usuarioAtual().id, item.id);
  });

  constructor() {
    // Vindo do botão "Solicitar empréstimo" do catálogo: já deixa o item escolhido
    const id = this.route.snapshot.queryParamMap.get('equipamento');
    if (id && this.disponiveis().some((e) => e.id === id)) {
      this.form.patchValue({ equipamentoId: id });
    }
  }

  /** Mostra a mensagem de um campo depois que o usuário mexeu nele. */
  getError(campo: 'equipamentoId' | 'quantidade' | 'dataPrevistaDevolucao' | 'justificativa'): string {
    const c = this.form.controls[campo];
    if (!c.touched || c.valid) return '';
    if (c.hasError('minlength')) return 'Descreva um pouco melhor (mínimo 10 caracteres).';
    if (c.hasError('min')) return 'A quantidade deve ser no mínimo 1.';
    if (c.hasError('max')) return 'Quantidade acima do que está disponível.';
    const obrigatorios = {
      equipamentoId: 'Escolha o material.',
      quantidade: 'Informe a quantidade.',
      dataPrevistaDevolucao: 'Informe a data de devolução.',
      justificativa: 'Explique para que o material será usado.',
    };
    return obrigatorios[campo];
  }

  enviar(): void {
    this.erro.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const resultado = this.emprestimos.solicitar(
      {
        itens: [{ equipamentoId: v.equipamentoId, quantidade: v.quantidade }],
        justificativa: v.justificativa.trim(),
        dataPrevistaRetirada: v.dataPrevistaRetirada,
        dataPrevistaDevolucao: v.dataPrevistaDevolucao,
      },
      this.auth.usuarioAtual(),
    );
    if (!resultado.ok) {
      this.erro.set(resultado.erro);
      return;
    }

    this.router.navigate(['/meus-emprestimos'], { queryParams: { enviado: 1 } });
  }
}
