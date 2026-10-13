import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Card } from '../../shared/components/card/card';
import { Emprestimo } from '../../core/models/emprestimo.model';
import { AuthService } from '../../core/services/auth.service';
import { EquipamentoService } from '../../core/services/equipamento.service';
import {
  EmprestimoService,
  NOME_STATUS_EMPRESTIMO,
} from '../../core/services/emprestimo.service';
import { formatarData } from '../../core/utils/date.utils';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [Card, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private readonly auth = inject(AuthService);
  private readonly equipamentos = inject(EquipamentoService);
  private readonly emprestimos = inject(EmprestimoService);

  readonly nomeStatus = NOME_STATUS_EMPRESTIMO;
  readonly data = formatarData;

  readonly ehAdmin = computed(() => this.auth.perfilAtual()?.toLowerCase() === 'admin');
  readonly primeiroNome = computed(() => (this.auth.nomeAtual() ?? '').split(' ')[0]);

  // ---- Métricas gerais (admin) ----
  readonly pendentes = computed(() => this.emprestimos.pendentes().length);
  readonly ativos = computed(() => this.emprestimos.ativos().length);
  readonly atrasados = computed(
    () => this.emprestimos.todas().filter((s) => this.emprestimos.estaAtrasado(s)).length,
  );
  readonly disponiveis = this.equipamentos.unidadesDisponiveis;
  readonly emManutencao = this.equipamentos.emManutencao;

  // ---- Métricas do usuário comum ----
  private readonly meus = computed(() => {
    const id = this.auth.usuarioAtual().id;
    return this.emprestimos.todas().filter((s) => s.solicitante.id === id);
  });
  readonly meusPendentes = computed(() => this.meus().filter((s) => s.status === 'pendente').length);
  readonly meusAtivos = computed(
    () => this.meus().filter((s) => s.status === 'aprovado' || s.status === 'em_andamento').length,
  );

  /** Últimos pedidos: todos (admin) ou só os do usuário. */
  readonly recentes = computed(() =>
    (this.ehAdmin() ? this.emprestimos.todas() : this.meus()).slice(0, 5),
  );

  itens(s: Emprestimo): string {
    return this.emprestimos.resumoItens(s);
  }
}
