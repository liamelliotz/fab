import { Component, HostListener, inject } from '@angular/core';
import { DemoService } from '../../../core/services/demo.service';
import { NotificationService } from '../../../core/services/notification.service';
import { DialogoDirective } from '../../directives/dialogo.directive';

/**
 * Restaurar os dados iniciais. NÃO aparece na tela: só abre com o atalho
 * Ctrl + Alt + Shift + R (em qualquer tela, inclusive no login), e pede confirmação.
 * Use antes de apresentar. (Ctrl + Shift + R não serve: o navegador usa para recarregar.)
 */
@Component({
  selector: 'app-restaurar-dados',
  standalone: true,
  imports: [DialogoDirective],
  templateUrl: './restaurar-dados.html',
  styleUrl: './restaurar-dados.css',
})
export class RestaurarDados {
  private readonly dados = inject(DemoService);
  private readonly avisos = inject(NotificationService);

  /** Janela aberta: fica no DemoService para a barra da demonstração também poder abrir. */
  readonly confirmando = this.dados.confirmandoRestauracao;

  @HostListener('document:keydown', ['$event'])
  atalho(evento: KeyboardEvent): void {
    if (!this.dados.ativo) return;
    if (evento.ctrlKey && evento.altKey && evento.shiftKey && evento.code === 'KeyR') {
      evento.preventDefault();
      this.confirmando.set(true);
    } else if (evento.key === 'Escape' && this.confirmando()) {
      this.fechar();
    }
  }

  fechar(): void {
    this.confirmando.set(false);
  }

  confirmar(): void {
    this.dados.restaurar();
    this.confirmando.set(false);
    this.avisos.sucesso('Dados restaurados ao estado inicial.');
  }
}
