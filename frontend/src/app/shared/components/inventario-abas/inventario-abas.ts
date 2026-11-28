import { Component, computed, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { EquipamentoService } from '../../../core/services/equipamento.service';
import { InsumoService } from '../../../core/services/insumo.service';

/**
 * Cabeçalho do INVENTÁRIO: o título e as duas partes (Equipamentos para empréstimo e Insumos
 * para consumo). Usado nas telas do professor e da coordenação; o botão de ação da página
 * (ex.: "Novo insumo") entra pelo atributo `acoes`.
 */
@Component({
  selector: 'app-inventario-abas',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="inv">
      <div class="inv__topo">
        <div>
          <h1>Inventário</h1>
          <p>{{ admin() ? 'Tudo o que a escola tem: cadastro, estoque e histórico.' : 'Tudo o que a escola tem para as suas aulas.' }}</p>
        </div>
        <ng-content select="[acoes]" />
      </div>
      <nav class="inv__abas" aria-label="Partes do inventário">
        <a class="inv__aba" [routerLink]="base() + '/equipamentos'" routerLinkActive="inv__aba--ativa" ariaCurrentWhenActive="page">
          <i class="fa-solid fa-laptop" aria-hidden="true"></i>
          <span class="inv__nome">Equipamentos</span>
          <span class="inv__dica">empréstimo · usa e devolve</span>
          <span class="inv__num">{{ totalEquipamentos() }}</span>
        </a>
        <a class="inv__aba" [routerLink]="base() + '/insumos'" routerLinkActive="inv__aba--ativa" ariaCurrentWhenActive="page">
          <i class="fa-solid fa-box-open" aria-hidden="true"></i>
          <span class="inv__nome">Insumos</span>
          <span class="inv__dica">consumo · não volta</span>
          <span class="inv__num">{{ totalInsumos() }}</span>
        </a>
      </nav>
    </header>
  `,
  styles: `
    :host { display: block; }
    .inv { display: flex; flex-direction: column; gap: 16px; }
    .inv__topo { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; }
    h1 { margin: 0 0 6px; color: var(--t-172b24); font-size: 30px; font-weight: 700; }
    p { margin: 0; color: var(--t-6b7280); font-size: 14px; }
    .inv__abas { display: flex; gap: 0; border-bottom: 1px solid var(--b-e5ebe8); overflow-x: auto; }
    .inv__aba {
      display: inline-flex; align-items: baseline; gap: 8px; flex: none; padding: 10px 18px 12px; margin-bottom: -1px;
      border-bottom: 3px solid transparent; color: var(--t-4b5563); font-size: 15px; text-decoration: none; white-space: nowrap;
    }
    .inv__aba i { align-self: center; color: var(--t-6b7280); }
    .inv__aba:hover { color: var(--t-172b24); background: var(--s-f7faf8); }
    .inv__aba:focus-visible { outline: 3px solid var(--b-24845c); outline-offset: -3px; }
    .inv__nome { font-weight: 700; }
    .inv__dica { color: var(--t-6b7280); font-size: 13px; }
    .inv__num { padding: 1px 8px; border-radius: 999px; background: var(--s-eef2f0); color: var(--t-374151); font-size: 12px; font-weight: 700; }
    .inv__aba--ativa { border-bottom-color: var(--b-24845c); color: var(--t-14532d); }
    .inv__aba--ativa i { color: var(--t-1f6f4c); }
    .inv__aba--ativa .inv__num { background: var(--s-dcfce7); color: var(--t-14532d); }
    @media (max-width: 560px) { .inv__dica { display: none; } }
  `,
})
export class InventarioAbas {
  private readonly equipamentos = inject(EquipamentoService);
  private readonly insumos = inject(InsumoService);

  /** true na área da coordenação (/admin/inventario). */
  readonly admin = input(false);
  readonly base = computed(() => (this.admin() ? '/admin/inventario' : '/inventario'));
  readonly totalEquipamentos = computed(() => (this.admin() ? this.equipamentos.itens() : this.equipamentos.catalogo()).length);
  readonly totalInsumos = computed(() => (this.admin() ? this.insumos.insumos() : this.insumos.ativos()).length);
}
