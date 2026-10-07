import { Component, signal } from '@angular/core';
import { Card } from '../../shared/components/card/card';

@Component({
  selector: 'app-dashboard',
  imports: [Card],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  /** Termo digitado na barra de pesquisa (a busca em si será ligada depois). */
  protected readonly busca = signal('');

  /** Espaços vazios da grelha, prontos para métricas e atalhos de ação rápida. */
  protected readonly cartoes = [1, 2, 3, 4, 5, 6];

  protected aoDigitar(evento: Event): void {
    this.busca.set((evento.target as HTMLInputElement).value);
  }
}