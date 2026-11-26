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
import { EmprestimoService } from '../../../core/services/emprestimo.service';
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
  private readonly emprestimos = inject(EmprestimoService);
  private readonly insumos = inject(InsumoService);
  readonly modoDemo = inject(AuthService).modoDemo;

  readonly nomeModulo = NOME_MODULO_AUDITORIA;
  readonly nomeMotivoBaixa = NOME_MOTIVO_BAIXA;
  readonly modulos = Object.keys(NOME_MODULO_AUDITORIA) as ModuloAuditoria[];
  readonly dataHora = formatarDataHora;

  readonly periodo = signal<number | 0>(30);
  readonly modulo = signal<ModuloAuditoria | ''>('');
  readonly pessoa = signal('');
  readonly busca = signal('');
  readonly soAlertas = signal(false);
  readonly limite = signal(60);

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
        (!this.soAlertas() || r.gravidade !== 'info') &&
        (!termo || `${r.acao} ${r.alvo} ${r.itens ?? ''} ${r.por} ${r.detalhe ?? ''}`.toLowerCase().includes(termo)),
    );
  });
  readonly visiveis = computed(() => this.filtrados().slice(0, this.limite()));

  readonly porModulo = computed(() => {
    const contagem: Record<ModuloAuditoria, number> = { emprestimos: 0, manutencao: 0, baixa: 0, insumos: 0 };
    for (const r of this.filtrados()) contagem[r.modulo]++;
    return contagem;
  });

  // Indicadores de controle patrimonial
  readonly baixas = this.manutencoes.baixas;
  readonly valorBaixado = this.auditoria.valorBaixado;
  readonly ocorrenciasAbertas = computed(() => this.manutencoes.pendentes().length);
  readonly emUsoComTermo = computed(() => {
    const emUso = this.emprestimos.emAndamento();
    return { total: emUso.length, comTermo: emUso.filter((s) => s.termoAceito).length };
  });
  readonly perdasInsumo = computed(() =>
    this.insumos.movimentacoes().filter((m) => m.motivo === 'perda' || m.motivo === 'vencimento').length,
  );

  moeda(valor: number): string {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
    this.periodo.set(0);
    this.modulo.set('');
    this.pessoa.set('');
    this.busca.set('');
    this.soAlertas.set(false);
  }
}
