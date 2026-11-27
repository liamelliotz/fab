import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Navbar } from '../../components/navbar/navbar';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, Navbar],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout {
  /**
   * Leitores de tela (NVDA, JAWS...) não percebem a troca de página num app de uma página só.
   * A cada navegação, o título da nova tela é anunciado numa região "aria-live".
   */
  readonly anuncio = signal('');

  constructor() {
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => {
        // Espera o título da rota ser aplicado antes de anunciar
        if (typeof document === 'undefined') return; // pré-render no servidor
        setTimeout(() => this.anuncio.set(`Página: ${document.title.replace(/\s*\|\s*FAB$/, '')}`), 150);
      });
  }

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
