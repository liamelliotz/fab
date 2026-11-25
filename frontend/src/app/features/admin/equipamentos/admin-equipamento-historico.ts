import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Emprestimo } from '../../../core/models/emprestimo.model';
import { Manutencao } from '../../../core/models/manutencao.model';
import { EmprestimoService, NOME_STATUS_EMPRESTIMO } from '../../../core/services/emprestimo.service';
import { EquipamentoService, NOME_STATUS_EQUIPAMENTO } from '../../../core/services/equipamento.service';
import {
  ManutencaoService,
  NOME_GRAVIDADE,
  NOME_STATUS_MANUTENCAO,
} from '../../../core/services/manutencao.service';
import { formatarData } from '../../../core/utils/date.utils';

/**
 * Histórico de UM equipamento: como está o estoque, com quem está agora, avarias e faltas
 * e todos os empréstimos (com a cadeia de responsáveis). Rota: /admin/equipamentos/:id/historico
 */
@Component({
  selector: 'app-admin-equipamento-historico',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-equipamento-historico.html',
  styleUrl: './admin-equipamento-historico.css',
})
export class AdminEquipamentoHistorico {
  private readonly equipamentos = inject(EquipamentoService);
  private readonly emprestimos = inject(EmprestimoService);
  private readonly manutencoes = inject(ManutencaoService);

  /** Id do equipamento, lido da rota (:id). */
  readonly id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: '',
  });

  readonly nomeStatus = NOME_STATUS_EQUIPAMENTO;
  readonly nomeStatusPedido = NOME_STATUS_EMPRESTIMO;
  readonly nomeStatusOc = NOME_STATUS_MANUTENCAO;
  readonly data = (iso?: string) => (iso ? formatarData(iso.slice(0, 10)) : '—');

  readonly item = computed(() => this.equipamentos.buscarPorId(this.id()));
  readonly estoque = computed(() => {
    const e = this.item();
    return e ? this.equipamentos.estoque(e) : null;
  });

  /** Larguras (%) da barra de estoque. */
  readonly barra = computed(() => {
    const s = this.estoque();
    if (!s || s.total === 0) return { disp: 0, emp: 0, man: 0 };
    return {
      disp: (s.disponiveis / s.total) * 100,
      emp: (s.emprestadas / s.total) * 100,
      man: (s.emManutencao / s.total) * 100,
    };
  });

  readonly ocorrencias = computed(() => this.manutencoes.doEquipamento(this.id()));

  /** Pedidos com este item, do mais recente para o mais antigo. */
  readonly pedidos = computed(() =>
    this.emprestimos
      .todas()
      .filter((s) => s.itens.some((i) => i.equipamentoId === this.id()))
      .sort((a, b) => (b.dataPrevistaRetirada > a.dataPrevistaRetirada ? 1 : -1)),
  );

  /** Pedidos com o item fora do laboratório agora (ou reservado para retirada). */
  readonly comQuem = computed(() =>
    this.pedidos().filter((s) => s.status === 'em_andamento' || s.status === 'aprovado'),
  );

  quantidade(s: Emprestimo): number {
    return s.itens.find((i) => i.equipamentoId === this.id())?.quantidade ?? 0;
  }

  cadeia(s: Emprestimo): string {
    return this.emprestimos.cadeiaResponsaveis(s).map((u) => u.nome).join(' → ');
  }

  /** Ocorrências deste item abertas na devolução deste pedido. */
  ocorrenciasDoPedido(s: Emprestimo): Manutencao[] {
    return this.ocorrencias().filter((m) => m.emprestimoId === s.id);
  }

  rotulo(m: Manutencao): string {
    return m.tipo === 'extravio' ? 'Falta' : `Avaria ${NOME_GRAVIDADE[m.gravidade ?? 'moderada'].toLowerCase()}`;
  }

  selo(m: Manutencao): string {
    return m.tipo === 'extravio' ? 'falta' : (m.gravidade ?? 'moderada');
  }

  atrasado(s: Emprestimo): boolean {
    return this.emprestimos.estaAtrasado(s);
  }
}
