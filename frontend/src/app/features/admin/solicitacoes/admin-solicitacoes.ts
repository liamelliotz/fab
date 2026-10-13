import { Component, computed, inject, signal } from '@angular/core';
import { Emprestimo, StatusEmprestimo } from '../../../core/models/emprestimo.model';
import {
  EmprestimoService,
  NOME_STATUS_EMPRESTIMO,
} from '../../../core/services/emprestimo.service';
import { formatarData } from '../../../core/utils/date.utils';

@Component({
  selector: 'app-admin-solicitacoes',
  standalone: true,
  templateUrl: './admin-solicitacoes.html',
  styleUrl: './admin-solicitacoes.css',
})
export class AdminSolicitacoes {
  private readonly service = inject(EmprestimoService);

  readonly data = formatarData;

  readonly busca = signal('');
  readonly filtroStatus = signal<StatusEmprestimo | ''>('');

  // Solicitação em avaliação (abre o painel de justificativa)
  readonly selecionada = signal<Emprestimo | null>(null);
  readonly decisao = signal<'aprovar' | 'reprovar' | null>(null);
  readonly justificativa = signal('');
  readonly erro = signal('');

  readonly solicitacoes = computed(() => {
    const termo = this.busca().trim().toLowerCase();
    const status = this.filtroStatus();
    return this.service
      .todas()
      .filter(
        (s) =>
          (!termo ||
            s.protocolo.toLowerCase().includes(termo) ||
            s.solicitante.nome.toLowerCase().includes(termo)) &&
          (!status || s.status === status),
      );
  });

  nomeStatus(status: StatusEmprestimo): string {
    return NOME_STATUS_EMPRESTIMO[status];
  }

  itens(s: Emprestimo): string {
    return this.service.resumoItens(s);
  }

  atualizarBusca(evento: Event): void {
    this.busca.set((evento.target as HTMLInputElement).value);
  }

  atualizarStatus(evento: Event): void {
    this.filtroStatus.set((evento.target as HTMLSelectElement).value as StatusEmprestimo | '');
  }

  atualizarJustificativa(evento: Event): void {
    this.justificativa.set((evento.target as HTMLTextAreaElement).value);
  }

  iniciar(s: Emprestimo, decisao: 'aprovar' | 'reprovar'): void {
    this.selecionada.set(s);
    this.decisao.set(decisao);
    this.justificativa.set('');
    this.erro.set('');
  }

  cancelar(): void {
    this.selecionada.set(null);
    this.decisao.set(null);
    this.erro.set('');
  }

  confirmar(): void {
    const alvo = this.selecionada();
    const decisao = this.decisao();
    const texto = this.justificativa().trim();
    if (!alvo || !decisao) return;

    // A justificativa só é obrigatória ao reprovar
    if (decisao === 'reprovar' && !texto) {
      this.erro.set('Informe o motivo da reprovação.');
      return;
    }

    const mensagem = this.service.avaliar(alvo.id, decisao === 'aprovar', texto);
    if (mensagem) {
      this.erro.set(mensagem);
      return;
    }
    this.cancelar();
  }
}
