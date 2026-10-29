import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Emprestimo } from '../../../core/models/emprestimo.model';
import { AuthService } from '../../../core/services/auth.service';
import {
  EmprestimoService,
  NOME_STATUS_EMPRESTIMO,
} from '../../../core/services/emprestimo.service';
import { NotificationService } from '../../../core/services/notification.service';
import { formatarCodigo } from '../../../core/utils/codigo.utils';
import { formatarData } from '../../../core/utils/date.utils';
import { TransferirDialog } from '../components/transferir-dialog/transferir-dialog';

@Component({
  selector: 'app-meus-emprestimos',
  standalone: true,
  imports: [RouterLink, TransferirDialog],
  templateUrl: './meus-emprestimos.html',
  styleUrl: './meus-emprestimos.css',
})
export class MeusEmprestimos {
  private readonly service = inject(EmprestimoService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly notificacoes = inject(NotificationService);

  readonly nomeStatus = NOME_STATUS_EMPRESTIMO;
  readonly data = formatarData;
  readonly codigo = formatarCodigo;

  /** true logo após enviar uma solicitação (a tela de envio redireciona com ?enviado=1). */
  readonly enviado = this.route.snapshot.queryParamMap.get('enviado') === '1';

  /** Pedido para o qual a janela "Transferir" está aberta. */
  readonly dialogo = signal<Emprestimo | null>(null);

  readonly eu = computed(() => this.auth.usuarioAtual());

  /** Pedidos que a pessoa abriu ou dos quais é a responsável atual. */
  readonly meus = computed(() => this.service.meusPedidos(this.eu().id));

  /** Transferências que outro professor quer fazer para esta pessoa. */
  readonly recebidas = computed(() => this.service.transferenciasRecebidas(this.eu().id));

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

  souResponsavel(s: Emprestimo): boolean {
    return s.responsavel.id === this.eu().id;
  }

  /** Frase sobre a cadeia de responsáveis ("Transferido para…", "Pedido original de…"). */
  papel(s: Emprestimo): string {
    const eu = this.eu().id;
    if (s.solicitante.id === eu && s.responsavel.id !== eu) {
      return `Transferido para ${s.responsavel.nome}`;
    }
    if (s.responsavel.id === eu && s.solicitante.id !== eu) {
      return `Pedido aberto por ${s.solicitante.nome}. Agora você é o responsável.`;
    }
    return '';
  }

  /** Por que não dá para transferir (null = pode). Só vale para quem está com o material. */
  erroTransferencia(s: Emprestimo): string | null {
    return this.service.erroTransferencia(s, this.eu().id);
  }

  podeCancelar(s: Emprestimo): boolean {
    return s.status === 'pendente' || s.status === 'aprovado';
  }

  cancelar(s: Emprestimo): void {
    const erro = this.service.cancelar(s.id);
    if (erro) this.notificacoes.erro(erro);
    else this.notificacoes.info(`Pedido ${s.protocolo} cancelado.`);
  }

  aceitar(s: Emprestimo): void {
    const erro = this.service.responderTransferencia(s.id, true);
    if (erro) this.notificacoes.erro(erro);
    else this.notificacoes.sucesso(`Você agora é responsável por ${this.itens(s)}. Prazo: ${formatarData(s.dataPrevistaDevolucao)}.`);
  }

  recusar(s: Emprestimo): void {
    const erro = this.service.responderTransferencia(s.id, false);
    if (erro) this.notificacoes.erro(erro);
    else this.notificacoes.info('Transferência recusada.');
  }

  cancelarTransferencia(s: Emprestimo): void {
    const erro = this.service.cancelarTransferencia(s.id);
    if (erro) this.notificacoes.erro(erro);
    else this.notificacoes.info('Pedido de transferência cancelado.');
  }
}
