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
  // Pedidos que a pessoa abriu ou dos quais é responsável (inclui os recebidos por transferência)
  private readonly meus = computed(() => this.emprestimos.meusPedidos(this.auth.usuarioAtual().id));

  /** Transferências de outros professores esperando a resposta desta pessoa. */
  readonly transferenciasParaMim = computed(
    () => this.emprestimos.transferenciasRecebidas(this.auth.usuarioAtual().id).length,
  );

  // ---- Avisos da coordenação ----
  readonly transferenciasPendentes = computed(
    () => this.emprestimos.todas().filter((s) => !!s.transferenciaPendente).length,
  );
  readonly avisosNaoLidos = this.emprestimos.avisosNaoLidos;
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

  /** Mostra "atrasado" no lugar de "em andamento" quando o prazo venceu. */
  statusExibido(s: Emprestimo): string {
    return this.emprestimos.estaAtrasado(s) ? 'atrasado' : s.status;
  }

  nomeStatusExibido(s: Emprestimo): string {
    return this.emprestimos.estaAtrasado(s) ? 'Atrasado' : this.nomeStatus[s.status];
  }
}
