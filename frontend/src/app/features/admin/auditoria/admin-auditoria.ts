import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Manutencao } from '../../../core/models/manutencao.model';
import {
  AuditoriaService,
  ModuloAuditoria,
  NOME_MODULO_AUDITORIA,
  registrosParaCsv,
} from '../../../core/services/auditoria.service';
import { AuthService } from '../../../core/services/auth.service';
import { InsumoService } from '../../../core/services/insumo.service';
import { ManutencaoService, NOME_MOTIVO_BAIXA } from '../../../core/services/manutencao.service';
import { baixarArquivo } from '../../../core/utils/arquivo.utils';
import { formatarDataHora, hojeISO } from '../../../core/utils/date.utils';
import { TermoBaixa } from '../../../shared/components/termo-baixa/termo-baixa';

/**
 * AUDITORIA: a trilha somente-leitura de tudo o que mexe no patrimônio da escola.
 * Junta empréstimos (com o balcão e as transferências), manutenção, baixas com termo e
 * movimentações de insumos. Dá para filtrar, exportar em CSV e abrir os termos de baixa.
 */
@Component({
  selector: 'app-admin-auditoria',
  standalone: true,
  imports: [RouterLink, TermoBaixa],
  templateUrl: './admin-auditoria.html',
  styleUrl: './admin-auditoria.css',
})
export class AdminAuditoria {
  private readonly auditoria = inject(AuditoriaService);
  private readonly manutencoes = inject(ManutencaoService);
  private readonly insumos = inject(InsumoService);
  readonly modoDemo = inject(AuthService).modoDemo;

  readonly nomeModulo = NOME_MODULO_AUDITORIA;
  readonly nomeMotivoBaixa = NOME_MOTIVO_BAIXA;
  readonly modulos = Object.keys(NOME_MODULO_AUDITORIA) as ModuloAuditoria[];
  readonly dataHora = formatarDataHora;

  readonly periodo = signal(30);
  readonly modulo = signal<ModuloAuditoria | ''>('');
  readonly pessoa = signal('');
  readonly busca = signal('');
  readonly pagina = signal(1);
  readonly porPagina = 15;

  readonly termoAberto = signal<Manutencao | null>(null);

  readonly pessoas = computed(() => [...new Set(this.auditoria.registros().map((r) => r.por))].sort());

  readonly filtrados = computed(() => {
    const dias = this.periodo();
    const desde = dias ? new Date(Date.now() - dias * 86_400_000).toISOString() : '';
    const termo = this.busca().trim().toLowerCase();
    return this.auditoria.registros().filter(
      (r) =>
        (!desde || r.em >= desde) &&
        (!this.modulo() || r.modulo === this.modulo()) &&
        (!this.pessoa() || r.por === this.pessoa()) &&
        (!termo || `${r.acao} ${r.alvo} ${r.itens ?? ''} ${r.por} ${r.detalhe ?? ''}`.toLowerCase().includes(termo)),
    );
  });
  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.filtrados().length / this.porPagina)));
  readonly visiveis = computed(() => {
    const inicio = (Math.min(this.pagina(), this.totalPaginas()) - 1) * this.porPagina;
    return this.filtrados().slice(inicio, inicio + this.porPagina);
  });

  // Indicadores de controle patrimonial
  readonly baixas = this.manutencoes.baixas;
  readonly valorBaixado = this.auditoria.valorBaixado;
  readonly ocorrenciasAbertas = computed(() => this.manutencoes.pendentes().length);
  readonly perdasInsumo = computed(() =>
    this.insumos.movimentacoes().filter((m) => m.motivo === 'perda' || m.motivo === 'vencimento').length,
  );

  moeda(valor: number): string {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  /** Troca um filtro e volta para a primeira página. */
  filtrar(acao: () => void): void {
    acao();
    this.pagina.set(1);
  }

  mudarPagina(delta: number): void {
    this.pagina.set(Math.min(this.totalPaginas(), Math.max(1, this.pagina() + delta)));
  }

  valor(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLSelectElement).value;
  }

  abrirTermo(id: string | undefined): void {
    const m = id ? this.manutencoes.buscarPorId(id) : undefined;
    if (m?.baixa) this.termoAberto.set(m);
  }

  exportar(): void {
    baixarArquivo(`fab-auditoria-${hojeISO()}.csv`, registrosParaCsv(this.filtrados()));
  }

  limparFiltros(): void {
    this.periodo.set(30);
    this.modulo.set('');
    this.pessoa.set('');
    this.busca.set('');
    this.pagina.set(1);
  }
}
