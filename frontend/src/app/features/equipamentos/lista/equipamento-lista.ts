import { Component, computed, inject, signal } from '@angular/core';
import { FiltroEquipamentoDTO } from '../../../core/models/equipamento.model';
import { EquipamentoService } from '../../../core/services/equipamento.service';
import { EquipamentoCard } from '../components/equipamento-card/equipamento-card';
import { EquipamentoFiltros } from '../components/equipamento-filtros/equipamento-filtros';

@Component({
  selector: 'app-equipamento-lista',
  standalone: true,
  imports: [EquipamentoCard, EquipamentoFiltros],
  templateUrl: './equipamento-lista.html',
  styleUrl: './equipamento-lista.css',
})
export class EquipamentoLista {
  private readonly service = inject(EquipamentoService);

  readonly filtros = signal<FiltroEquipamentoDTO>({});

  // Usa o catálogo compartilhado: o que o admin cadastra/desativa reflete aqui
  readonly equipamentos = computed(() => {
    const { busca, categoria, status } = this.filtros();
    const termo = busca?.toLowerCase();
    return this.service
      .catalogo()
      .filter(
        (e) =>
          (!termo ||
            e.nome.toLowerCase().includes(termo) ||
            e.codigoPatrimonio.toLowerCase().includes(termo)) &&
          (!categoria || e.categoria === categoria) &&
          (!status || e.status === status),
      );
  });
}
