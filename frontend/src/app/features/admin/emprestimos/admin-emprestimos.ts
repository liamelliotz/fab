import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Emprestimo, StatusEmprestimo } from '../../../core/models/emprestimo.model';
import {
  EmprestimoService,
  NOME_STATUS_EMPRESTIMO,
} from '../../../core/services/emprestimo.service';
import { formatarData, formatarDataHora } from '../../../core/utils/date.utils';

type FiltroStatus = StatusEmprestimo | 'todos';

@Component({
  selector: 'app-admin-emprestimos',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-emprestimos.html',
  styleUrl: './admin-emprestimos.css',
})
export class AdminEmprestimos {
  private readonly service = inject(EmprestimoService);

  readonly data = formatarData;
  readonly dataHora = formatarDataHora;
  readonly nomeStatus = NOME_STATUS_EMPRESTIMO;

  readonly busca = signal('');
  readonly filtro = signal<FiltroStatus>('todos');

  /** Tudo que já passou da análise (pedidos pendentes ficam na tela Solicitações). */
  private readonly emCirculacao = computed(() =>
    this.service.todas().filter((s) => s.status !== 'pendente'),
  );

  readonly totalAtivos = computed(() => this.service.emAndamento().length);
  readonly totalAguardando = computed(
    () => this.service.todas().filter((s) => s.status === 'aprovado').length,
  );
  readonly totalAtrasados = computed(
    () => this.service.todas().filter((s) => this.service.estaAtrasado(s)).length,
  );
  readonly totalDevolvidos = computed(
    () => this.service.todas().filter((s) => s.status === 'devolvido').length,
  );
  readonly totalTransferencias = computed(
    () => this.service.todas().filter((s) => !!s.transferenciaPendente).length,
  );

  readonly emprestimos = computed(() => {
    const termo = this.busca().trim().toLowerCase();
    const filtro = this.filtro();
    return this.emCirculacao().filter((s) => {
      if (filtro === 'atrasado' && !this.service.estaAtrasado(s)) return false;
      if (filtro !== 'todos' && filtro !== 'atrasado' && s.status !== filtro) return false;
      return (
        !termo ||
        s.protocolo.toLowerCase().includes(termo) ||
        s.responsavel.nome.toLowerCase().includes(termo) ||
        s.solicitante.nome.toLowerCase().includes(termo) ||
        this.service.resumoItens(s).toLowerCase().includes(termo)
      );
    });
  });

  /** Movimentações recentes (novas solicitações, transferências...). */
  readonly avisos = computed(() => this.service.avisos().slice(0, 8));
  readonly naoLidos = this.service.avisosNaoLidos;

  itens(s: Emprestimo): string {
    return this.service.resumoItens(s);
  }

  atrasado(s: Emprestimo): boolean {
    return this.service.estaAtrasado(s);
  }

  statusExibido(s: Emprestimo): string {
    return this.atrasado(s) ? 'atrasado' : s.status;
  }

  nomeStatusExibido(s: Emprestimo): string {
    return this.atrasado(s) ? 'Atrasado' : this.nomeStatus[s.status];
  }

  atualizarBusca(evento: Event): void {
    this.busca.set((evento.target as HTMLInputElement).value);
  }

  atualizarFiltro(evento: Event): void {
    this.filtro.set((evento.target as HTMLSelectElement).value as FiltroStatus);
  }

  marcarLidos(): void {
    this.service.marcarAvisosLidos();
  }
}
