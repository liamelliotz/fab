import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Emprestimo } from '../../../../core/models/emprestimo.model';
import { EmprestimoService, MINIMO_MOTIVO_CANCELAMENTO } from '../../../../core/services/emprestimo.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { DialogoDirective } from '../../../../shared/directives/dialogo.directive';

/** Janela "Cancelar pedido": só cancela com um motivo, que fica registrado na linha do tempo e na auditoria. */
@Component({
  selector: 'app-cancelar-dialog',
  standalone: true,
  imports: [DialogoDirective],
  templateUrl: './cancelar-dialog.html',
  styleUrl: './cancelar-dialog.css',
})
export class CancelarDialog {
  private readonly service = inject(EmprestimoService);
  private readonly notificacoes = inject(NotificationService);

  readonly pedido = input.required<Emprestimo>();
  readonly fechar = output<void>();
  readonly cancelado = output<void>();

  readonly minimo = MINIMO_MOTIVO_CANCELAMENTO;
  readonly motivos = [
    'Aula ou atividade cancelada',
    'Mudança de data da atividade',
    'Material não é mais necessário',
    'Pedido feito por engano',
  ];
  readonly motivo = signal('');
  readonly erro = signal('');
  readonly itens = computed(() => this.service.resumoItens(this.pedido()));
  readonly faltam = computed(() => Math.max(0, this.minimo - this.motivo().trim().length));

  escolher(texto: string): void {
    this.motivo.set(texto);
    this.erro.set('');
  }

  escrever(evento: Event): void {
    this.motivo.set((evento.target as HTMLTextAreaElement).value);
    this.erro.set('');
  }

  confirmar(): void {
    const erro = this.service.cancelar(this.pedido().id, this.motivo());
    if (erro) {
      this.erro.set(erro);
      return;
    }
    this.notificacoes.info(`Pedido ${this.pedido().protocolo} cancelado.`);
    this.cancelado.emit();
    this.fechar.emit();
  }
}
