import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
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