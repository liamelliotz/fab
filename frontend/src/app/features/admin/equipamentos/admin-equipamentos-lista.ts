import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  CategoriaEquipamento,
  Equipamento,
  StatusEquipamento,
} from '../../../core/models/equipamento.model';
import { AdminEquipamentosStore, CATEGORIAS } from './admin-equipamentos.store';

const NOME_STATUS: Record<StatusEquipamento, string> = {
  disponivel: 'Disponível',
  emprestado: 'Emprestado',
  em_manutencao: 'Em manutenção',
  inativo: 'Inativo',
  descartado: 'Descartado',
};

@Component({
  selector: 'app-admin-equipamentos-lista',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-equipamentos-lista.html',
  styleUrl: './admin-equipamentos-lista.css',
})
export class AdminEquipamentosLista {
  private readonly store = inject(AdminEquipamentosStore);

  readonly categorias = CATEGORIAS;

  readonly busca = signal('');
  readonly filtroCategoria = signal<CategoriaEquipamento | ''>('');

  readonly equipamentos = computed(() => {
    const termo = this.busca().trim().toLowerCase();
    const categoria = this.filtroCategoria();
    return this.store
      .itens()
      .filter(
        (e) =>
          (!termo ||
            e.nome.toLowerCase().includes(termo) ||
            e.codigoPatrimonio.toLowerCase().includes(termo)) &&
          (!categoria || e.categoria === categoria),
      );
  });

  nomeStatus(status: StatusEquipamento): string {
    return NOME_STATUS[status];
  }

  nomeCategoria(categoria: CategoriaEquipamento): string {
    return this.categorias.find((c) => c.valor === categoria)?.nome ?? categoria;
  }

  atualizarBusca(evento: Event): void {
    this.busca.set((evento.target as HTMLInputElement).value);
  }

  atualizarCategoria(evento: Event): void {
    this.filtroCategoria.set(
      (evento.target as HTMLSelectElement).value as CategoriaEquipamento | '',
    );
  }

  alternarAtivo(e: Equipamento): void {
    this.store.alternarAtivo(e.id);
  }
}