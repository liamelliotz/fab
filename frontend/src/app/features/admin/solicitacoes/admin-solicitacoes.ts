import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { RequisicaoInsumoService } from '../../../core/services/requisicao-insumo.service';
import { RequisicoesInsumo } from '../insumos/requisicoes/requisicoes-insumo';
import { Subscription, finalize, map } from 'rxjs';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Emprestimo, StatusEmprestimo } from '../../../core/models/emprestimo.model';
import { RespostaPaginada } from '../../../core/models/pagination.model';
import { EmprestimoAdminService, mensagemErroAdmin } from '../../../core/services/emprestimo-admin.service';
import { EmprestimoService, NOME_STATUS_EMPRESTIMO } from '../../../core/services/emprestimo.service';
import { NotificationService } from '../../../core/services/notification.service';
import { formatarData } from '../../../core/utils/date.utils';
import { DialogoDirective } from '../../../shared/directives/dialogo.directive';

@Component({ selector: 'app-admin-solicitacoes', standalone: true, imports: [RouterLink, DialogoDirective, RequisicoesInsumo],
  templateUrl: './admin-solicitacoes.html', styleUrl: './admin-solicitacoes.css' })
export class AdminSolicitacoes {
  readonly service = inject(EmprestimoAdminService);
  private readonly notificacoes = inject(NotificationService);
  private readonly destroy = inject(DestroyRef);
  private consulta?: Subscription;
  readonly data = formatarData;
  readonly requisicoes = inject(RequisicaoInsumoService);
  private readonly emprestimos = inject(EmprestimoService);
  readonly pendentesEmprestimo = computed(() => this.emprestimos.pendentes().length);
  private readonly route = inject(ActivatedRoute);
  /** Aba ativa: empréstimos ou requisições de insumo (?aba=insumos). */
  readonly aba = toSignal(
    this.route.queryParamMap.pipe(map((q) => (q.get('aba') === 'insumos' ? 'insumos' : 'emprestimos'))),
    { initialValue: this.route.snapshot.queryParamMap.get('aba') === 'insumos' ? 'insumos' : 'emprestimos' },
  );
  readonly busca = signal('');
  readonly filtroStatus = signal<StatusEmprestimo | ''>('pendente');
  readonly pagina = signal(1);
  readonly resposta = signal<RespostaPaginada<Emprestimo> | null>(null);
  readonly carregando = signal(false);
  readonly erroLista = signal('');
  readonly salvando = signal(false);
  readonly selecionada = signal<Emprestimo | null>(null);
  readonly decisao = signal<'aprovar' | 'reprovar' | null>(null);
  readonly justificativa = signal('');
  readonly erro = signal('');
  readonly solicitacoes = computed(() => {
    const termo = this.busca().trim().toLowerCase();
    return (this.resposta()?.itens ?? []).filter((s) => !termo ||
      s.protocolo.toLowerCase().includes(termo) || s.solicitante.nome.toLowerCase().includes(termo));
  });
  constructor() {
    this.destroy.onDestroy(() => this.consulta?.unsubscribe());
    this.carregar();
  }
  carregar(): void {
    this.consulta?.unsubscribe();
    this.carregando.set(true); this.erroLista.set(''); this.resposta.set(null);
    this.consulta = this.service.listar({ status: this.filtroStatus() || undefined, pagina: this.pagina(), itensPorPagina: 10 })
      .pipe(finalize(() => this.carregando.set(false))).subscribe({
        next: (resposta) => {
          if (!resposta.itens.length && resposta.totalItens > 0 && this.pagina() > 1) {
            this.pagina.update((p) => p - 1); this.carregar(); return;
          }
          this.resposta.set(resposta);
        }, error: (erro) => this.erroLista.set(mensagemErroAdmin(erro)),
      });
  }
  nomeStatus(status: StatusEmprestimo): string { return NOME_STATUS_EMPRESTIMO[status]; }
  itens(s: Emprestimo): string { return this.service.resumoItens(s); }
  atualizarBusca(e: Event): void { this.busca.set((e.target as HTMLInputElement).value); }
  atualizarStatus(e: Event): void {
    this.filtroStatus.set((e.target as HTMLSelectElement).value as StatusEmprestimo | '');
    this.pagina.set(1); this.carregar();
  }
  mudarPagina(delta: number): void {
    if (this.carregando() || this.salvando()) return;
    if ((delta < 0 && !this.resposta()?.temAnterior) || (delta > 0 && !this.resposta()?.temProxima)) return;
    this.pagina.update((p) => p + delta); this.carregar();
  }
  atualizarJustificativa(e: Event): void { this.justificativa.set((e.target as HTMLTextAreaElement).value); }
  iniciar(s: Emprestimo, decisao: 'aprovar' | 'reprovar'): void {
    this.selecionada.set(s); this.decisao.set(decisao); this.justificativa.set(''); this.erro.set('');
  }
  cancelar(): void { this.selecionada.set(null); this.decisao.set(null); this.erro.set(''); }
  confirmar(): void {
    if (this.salvando()) return;
    const alvo = this.selecionada(); const decisao = this.decisao(); const motivo = this.justificativa().trim();
    if (!alvo || !decisao) return;
    if (decisao === 'reprovar' && (motivo.length < 5 || motivo.length > 300)) {
      this.erro.set('Informe um motivo de reprovação com 5 a 300 caracteres.'); return;
    }
    this.salvando.set(true); this.erro.set('');
    this.service.avaliar(alvo.id, { aprovado: decisao === 'aprovar', ...(decisao === 'reprovar' ? { motivo } : {}) })
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.salvando.set(false))).subscribe({
        next: () => {
          this.notificacoes.sucesso(`${alvo.protocolo} ${decisao === 'aprovar' ? 'aprovado' : 'reprovado'}.`);
          this.cancelar(); this.carregar();
        }, error: (erro) => this.erro.set(mensagemErroAdmin(erro)),
      });
  }
}
