// "input" é a função do Angular que declara uma propriedade que o componente PAI pode preencher
import { Component, input } from '@angular/core';

// Tipo que limita as variantes visuais aceitas pelo botão.
// Se alguém passar outro valor, o TypeScript acusa erro.
export type ButtonVariant = 'primary' | 'secondary' | 'google';

@Component({
  // Nome da tag usada nos templates: <app-button>
  selector: 'app-button',
  // Componente standalone: não precisa ser declarado em um NgModule
  standalone: true,
  // Arquivos de template e estilo deste componente
  templateUrl: './button.html',
  styleUrl: './button.css',
})
// Se o seu Angular gerou o nome "ButtonComponent", use esse nome aqui
export class Button {
  // Variante visual: principal (verde), secundária ou Google. Padrão: 'primary'
  variant = input<ButtonVariant>('primary');

  // Tipo HTML do botão. Use 'submit' dentro de formulários. Padrão: 'button'
  type = input<'button' | 'submit' | 'reset'>('button');

  // Quando true, o botão fica desabilitado (não clica e fica opaco)
  disabled = input(false);

  // Quando true, o botão ocupa 100% da largura do contêiner
  fullWidth = input(false);
}