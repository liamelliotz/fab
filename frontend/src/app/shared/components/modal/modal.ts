import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output
} from '@angular/core';

// Permite usar recursos do Angular como *ngIf.
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',

  // Esse componente funciona sozinho.
  standalone: true,

  // IMPORTANTE:
  // CommonModule permite usar *ngIf no modal.html.
  imports: [CommonModule],

  templateUrl: './modal.html',
  styleUrl: './modal.css',
})
export class ModalComponent {

  /*
    Diz se o modal está aberto.

    false = fechado

    true = aberto
  */
  @Input() open = false;


  /*
    Título que aparece no modal.
  */
  @Input() title = 'Confirmação';


  /*
    Mensagem principal.
  */
  @Input() message = 'Deseja realmente continuar?';


  /*
    Texto do botão de confirmar.
  */
  @Input() confirmText = 'Confirmar';


  /*
    Texto do botão cancelar.
  */
  @Input() cancelText = 'Cancelar';


  /*
    Se true, o botão de confirmação
    ficará vermelho.
  */
  @Input() danger = false;


  /*
    Permite fechar clicando fora do modal.
  */
  @Input() closeOnBackdrop = true;


  /*
    Evento disparado quando confirmou.
  */
  @Output() confirmed = new EventEmitter<void>();


  /*
    Evento disparado quando cancelou.
  */
  @Output() cancelled = new EventEmitter<void>();


  /*
    Evento geral de fechamento.
  */
  @Output() closed = new EventEmitter<void>();


  /*
    ESC do teclado também fecha.
  */
  @HostListener('document:keydown.escape')
  onEscape(): void {

    if (this.open) {
      this.cancel();
    }

  }


  /*
    Usuário clicou no fundo escuro.
  */
  onBackdropClick(): void {

    if (this.closeOnBackdrop) {
      this.cancel();
    }

  }


  /*
    Usuário confirmou.
  */
  confirm(): void {

    // Avisamos o componente pai.
    this.confirmed.emit();

    // Depois fechamos.
    this.closed.emit();

  }


  /*
    Usuário cancelou.
  */
  cancel(): void {

    // Avisamos o componente pai.
    this.cancelled.emit();

    // Fechamos.
    this.closed.emit();

  }

}