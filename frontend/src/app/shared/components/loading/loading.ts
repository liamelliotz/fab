import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading',

  // Componente independente.
  standalone: true,

  // HTML.
  templateUrl: './loading.html',

  // CSS.
  styleUrl: './loading.css',
})
export class LoadingComponent {

  // Texto mostrado abaixo do spinner.
  //
  // Se ninguém mandar nada,
  // aparecerá "Carregando..."
  @Input() message = 'Carregando...';


  // Decide se o loading ocupará
  // a tela inteira.
  @Input() overlay = false;
}