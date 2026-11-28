import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LOCAIS_DE_USO } from '../../../core/constants/escola-modelo.constants';
import { AuthService } from '../../../core/services/auth.service';
import { EmprestimoService } from '../../../core/services/emprestimo.service';
import { EquipamentoService } from '../../../core/services/equipamento.service';
import { RegrasEmprestimoService, nomeCategoria } from '../../../core/services/regras-emprestimo.service';
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
  private readonly regras = inject(RegrasEmprestimoService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder).nonNullable;

  readonly hoje = hojeISO();
  /** Salas e laboratórios da escola onde o material pode ser usado (alimenta o mapa de itens). */
  readonly locais = LOCAIS_DE_USO;
  readonly erro = signal('');

  readonly form = this.fb.group({
    equipamentoId: ['', Validators.required],
    quantidade: [1, [Validators.required, Validators.min(1)]],
    dataPrevistaRetirada: [hojeISO(), Validators.required],
    dataPrevistaDevolucao: ['', Validators.required],
    justificativa: ['', [Validators.required, Validators.minLength(10)]],
    localUsoId: ['', Validators.required],
    localUsoDetalhe: [''],
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

  /** Suspensão ou material atrasado: a pessoa não pode pedir agora (a tela explica e trava o envio). */
  readonly impedimento = computed(() => this.emprestimos.impedimentoParaPedir(this.auth.usuarioAtual().id));

  /** Limite por categoria do material escolhido e quanto a pessoa já tem em pedidos abertos. */
  readonly limiteCategoria = computed(() => {
    const item = this.selecionado();
    if (!item) return null;
    const limite = this.regras.limite(item.categoria);
    if (limite === null) return null;
    const ja = this.emprestimos.unidadesAbertasPorCategoria(this.auth.usuarioAtual().id).get(item.categoria) ?? 0;
    return { limite, ja, nome: nomeCategoria(item.categoria), resta: Math.max(0, limite - ja) };
  });

  /** Depois de aprovado, até quando o pedido espera a retirada. */
  readonly prazoRetiradaTexto = computed(() => formatarData(this.regras.prazoRetirada(this.retirada() || hojeISO())));
  readonly diasParaRetirar = computed(() => this.regras.regras().diasParaRetirar);

  readonly un = (n: number) => (n === 1 ? '1 unidade' : `${n} unidades`);

  constructor() {
    // Vindo do botão "Solicitar empréstimo" do catálogo: já deixa o item escolhido
    const id = this.route.snapshot.queryParamMap.get('equipamento');
    if (id && this.disponiveis().some((e) => e.id === id)) {
      this.form.patchValue({ equipamentoId: id });
    }
  }

  /** Mostra a mensagem de um campo depois que o usuário mexeu nele. */
  getError(campo: 'equipamentoId' | 'quantidade' | 'dataPrevistaDevolucao' | 'justificativa' | 'localUsoId'): string {
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
      localUsoId: 'Escolha onde o material será usado.',
    };
    return obrigatorios[campo];
  }

  enviar(): void {
    this.erro.set('');
    const bloqueio = this.impedimento();
    if (bloqueio) {
      this.erro.set(bloqueio);
      return;
    }
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
        localUso: { localId: v.localUsoId, detalhe: v.localUsoDetalhe.trim() || undefined },
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
