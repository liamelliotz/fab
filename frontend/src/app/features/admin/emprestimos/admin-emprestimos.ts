import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import { Emprestimo, StatusEmprestimo } from '../../../core/models/emprestimo.model';
import { RespostaPaginada } from '../../../core/models/pagination.model';
import { EmprestimoAdminService, mensagemErroAdmin } from '../../../core/services/emprestimo-admin.service';
import { NOME_STATUS_EMPRESTIMO } from '../../../core/services/emprestimo.service';
import { formatarData } from '../../../core/utils/date.utils';

type FiltroStatus = StatusEmprestimo | 'todos';
@Component({ selector: 'app-admin-emprestimos', standalone: true, imports: [RouterLink],
  templateUrl: './admin-emprestimos.html', styleUrl: './admin-emprestimos.css' })
export class AdminEmprestimos {
  readonly service = inject(EmprestimoAdminService);
  private readonly destroy = inject(DestroyRef);
  private consulta?: Subscription;
  readonly data = formatarData;
  readonly nomeStatus = NOME_STATUS_EMPRESTIMO;
  readonly busca = signal('');
  readonly filtro = signal<FiltroStatus>('todos');
  readonly atrasadosApenas = signal(false);
  readonly pagina = signal(1);
  readonly resposta = signal<RespostaPaginada<Emprestimo> | null>(null);
  readonly carregando = signal(false);
  readonly erro = signal('');
  readonly emprestimos = computed(() => {
    const termo = this.busca().trim().toLowerCase();
    return (this.resposta()?.itens ?? []).filter((s) => !termo ||
      [s.protocolo, s.responsavel.nome, s.solicitante.nome, this.itens(s)].some((t) => t.toLowerCase().includes(termo)));
  });
  constructor() { this.destroy.onDestroy(() => this.consulta?.unsubscribe()); this.carregar(); }
  carregar(): void {
    this.consulta?.unsubscribe(); this.carregando.set(true); this.erro.set(''); this.resposta.set(null);
    this.consulta = this.service.listar({ status: this.filtro() === 'todos' ? undefined : this.filtro() as StatusEmprestimo,
      atrasadosApenas: this.atrasadosApenas() || undefined, pagina: this.pagina(), itensPorPagina: 10 })
      .pipe(finalize(() => this.carregando.set(false))).subscribe({ next: (dados) => this.resposta.set(dados),
        error: (erro) => this.erro.set(mensagemErroAdmin(erro)) });
  }
  itens(s: Emprestimo): string { return this.service.resumoItens(s); }
  atualizarBusca(e: Event): void { this.busca.set((e.target as HTMLInputElement).value); }
  atualizarFiltro(e: Event): void {
    this.filtro.set((e.target as HTMLSelectElement).value as FiltroStatus); this.pagina.set(1); this.carregar();
  }
  atualizarAtrasados(e: Event): void {
    this.atrasadosApenas.set((e.target as HTMLInputElement).checked); this.pagina.set(1); this.carregar();
  }
  mudarPagina(delta: number): void {
    if (this.carregando()) return;
    if ((delta < 0 && !this.resposta()?.temAnterior) || (delta > 0 && !this.resposta()?.temProxima)) return;
    this.pagina.update((p) => p + delta); this.carregar();
  }
}
