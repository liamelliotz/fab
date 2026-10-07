// Importamos Component e signal do Angular.
import { Component, signal } from '@angular/core';

// Permite usar o RouterOutlet.
import { RouterOutlet } from '@angular/router';

// Nosso componente Loading.
import { LoadingComponent } from './shared/components/loading/loading';

// Nosso componente Alert.
import { AlertComponent } from './shared/components/alert/alert';

// Nosso componente Modal.
import { ModalComponent } from './shared/components/modal/modal';

import { CommonModule } from '@angular/common';

import { PhoneMaskDirective} from './shared/directives/phone-mask/phone-mask'

import { CpfMaskDirective } from './shared/directives/cpf-mask/cpf-mask';

import { ReturnDatePipe } from './shared/pipes/date-br.pipe'

import { PatrimonyCodePipe } from './shared/pipes/patrimony-code.pipe';

import { StatusPipe } from './shared/pipes/status.pipe';

@Component({
  // Nome do componente principal da aplicação.
  selector: 'app-root',

  // Componentes que podem ser usados dentro do app.html.
  imports: [
    RouterOutlet,
    LoadingComponent,
    AlertComponent,
    ModalComponent,
    CommonModule,
    PhoneMaskDirective,
    CpfMaskDirective,
      ReturnDatePipe,
      PatrimonyCodePipe,
      StatusPipe
  ],

  // HTML principal da aplicação.
  templateUrl: './app.html',

  // CSS principal da aplicação.
  styleUrl: './app.css'
})
export class App {

  // Título da aplicação.
  protected readonly title = signal('frontend');



  // Controla se o Modal está aberto.
  //
  // false = fechado
  // true = aberto
  modalAberto = false;



  // Função para abrir o Modal.
  abrirModal(): void {

    this.modalAberto = true;

  }


  // Executada quando o usuário confirma.
  confirmouModal(): void {

    console.log('Usuário confirmou!');

    this.modalAberto = false;

  }


  // Executada quando o usuário cancela.
  cancelouModal(): void {

    console.log('Usuário cancelou!');

    this.modalAberto = false;

  }


  // Executada quando o Modal é fechado.
  fechouModal(): void {

    console.log('Modal fechado.');

    this.modalAberto = false;

  }

}