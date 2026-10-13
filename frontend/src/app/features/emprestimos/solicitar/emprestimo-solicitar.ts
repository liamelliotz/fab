import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { EmprestimoService } from '../../../core/services/emprestimo.service';
import { EquipamentoService } from '../../../core/services/equipamento.service';
import { hojeISO } from '../../../core/utils/date.utils';

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
    const item = this.equipamentos.buscarPorId(v.equipamentoId);
    if (!item || item.status !== 'disponivel') {
      this.erro.set('Este material não está mais disponível.');
      return;
    }
    if (v.quantidade > item.quantidadeDisponivel) {
      this.erro.set(`Só há ${item.quantidadeDisponivel} unidade(s) disponível(is).`);
      return;
    }
    if (v.dataPrevistaRetirada < this.hoje) {
      this.erro.set('A data de retirada não pode ser anterior a hoje.');
      return;
    }
    if (v.dataPrevistaDevolucao < v.dataPrevistaRetirada) {
      this.erro.set('A devolução deve ser na mesma data da retirada ou depois dela.');
      return;
    }

    this.emprestimos.solicitar(
      {
        itens: [{ equipamentoId: v.equipamentoId, quantidade: v.quantidade }],
        justificativa: v.justificativa.trim(),
        dataPrevistaRetirada: v.dataPrevistaRetirada,
        dataPrevistaDevolucao: v.dataPrevistaDevolucao,
      },
      this.auth.usuarioAtual(),
    );

    this.router.navigate(['/meus-emprestimos'], { queryParams: { enviado: 1 } });
  }
}
