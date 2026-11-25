import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from '../../components/navbar/navbar';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, Navbar],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout {
  /**
   * Link "Pular para o conteúdo": quem navega pelo teclado não precisa passar pelo menu
   * inteiro em toda tela. Foca o <main> sem mudar a URL (um href="#..." puro recarregaria
   * a página por causa do <base href="/">).
   */
  pularParaConteudo(evento: Event): void {
    evento.preventDefault();
    document.getElementById('conteudo')?.focus();
  }
}