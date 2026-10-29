import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Emprestimo } from '../../../../core/models/emprestimo.model';
import { EmprestimoService } from '../../../../core/services/emprestimo.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { formatarData } from '../../../../core/utils/date.utils';

/**
 * Janela "Transferir pedido": o responsável escolhe outro professor e explica o motivo.
 * O material continua no nome de quem pediu até o destinatário aceitar, e o prazo não muda.
 */
@Component({
  selector: 'app-transferir-dialog',
  standalone: true,
  templateUrl: './transferir-dialog.html',
  styleUrl: './transferir-dialog.css',
})
export class TransferirDialog {
  private readonly service = inject(EmprestimoService);
  private readonly notificacoes = inject(NotificationService);

  readonly pedido = input.required<Emprestimo>();
  readonly fechar = output<void>();

  readonly paraId = signal('');
  readonly motivo = signal('');
  readonly erro = signal('');

  readonly data = formatarData;
  readonly candidatos = computed(() => this.service.candidatosTransferencia(this.pedido()));
  readonly itens = computed(() => this.service.resumoItens(this.pedido()));

  atualizarMotivo(evento: Event): void {
    this.motivo.set((evento.target as HTMLTextAreaElement).value);
  }

  enviar(): void {
    this.erro.set('');
    if (!this.paraId()) {
      this.erro.set('Escolha para quem o material será transferido.');
      return;
    }
    const pedido = this.pedido();
    const erro = this.service.solicitarTransferencia(pedido.id, this.paraId(), this.motivo());
    if (erro) {
      this.erro.set(erro);
      return;
    }
    const destino = this.candidatos().find((c) => c.usuario.id === this.paraId());
    this.notificacoes.sucesso(
      `Pedido enviado${destino ? ' a ' + destino.usuario.nome : ''}. O material continua no seu nome até a pessoa aceitar.`,
    );
    this.fechar.emit();
  }
}
