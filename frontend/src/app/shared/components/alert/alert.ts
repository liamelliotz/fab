import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export type AlertType = 'success' | 'warning' | 'error';

@Component({
  selector: 'app-alert',

  // Dizemos ao Angular que esse componente
  // pode ser usado sozinho.
  standalone: true,

  // Precisamos disso porque usamos *ngIf no HTML.
  imports: [CommonModule],

  // Onde está o HTML desse componente?
  templateUrl: './alert.html',

  // Onde está o CSS?
  styleUrl: './alert.css',
})
export class AlertComponent {

  // Tipo do alerta.
  //
  // Só podemos colocar:
  // success
  // warning
  // error
  @Input() type: AlertType = 'success';


  // Texto que aparecerá para o usuário.
  //
  // Exemplo:
  // "Cadastro realizado com sucesso!"
  @Input() message = '';


  // Define se aparecerá o botão X.
  @Input() dismissible = true;


  // Evento enviado para o componente pai
  // quando o usuário clicar no X.
  @Output() closed = new EventEmitter<void>();


  // Escolhe o símbolo de acordo com o tipo.
  get icon(): string {

    // Se for sucesso:
    if (this.type === 'success') {
      return '✓';
    }

    // Se for aviso:
    if (this.type === 'warning') {
      return '!';
    }

    // Se for erro:
    return '×';
  }


  // Essa função será chamada quando
  // o usuário clicar no X.
  close(): void {

    // Avisamos ao componente pai:
    // "Ei! O usuário fechou o alerta."
    this.closed.emit();
  }
}