import { Component, EventEmitter, Output } from '@angular/core';
import {
  CategoriaEquipamento,
  FiltroEquipamentoDTO,
  StatusEquipamento,
} from '../../../../core/models/equipamento.model';

@Component({
  selector: 'app-equipamento-filtros',
  standalone: true,
  templateUrl: './equipamento-filtros.html',
  styleUrl: './equipamento-filtros.css',
})
export class EquipamentoFiltros {
  @Output() filtrosChange = new EventEmitter<FiltroEquipamentoDTO>();

  private busca = '';
  private categoria = '';
  private status = '';

  readonly categorias: { valor: CategoriaEquipamento; nome: string }[] = [
    { valor: 'ferramenta', nome: 'Ferramenta' },
    { valor: 'eletronico', nome: 'Eletrônico' },
    { valor: 'impressora_3d', nome: 'Impressora 3D' },
    { valor: 'corte_laser', nome: 'Corte a laser' },
    { valor: 'consumivel', nome: 'Consumível' },
    { valor: 'outros', nome: 'Outros' },
  ];

  readonly statuses: { valor: StatusEquipamento; nome: string }[] = [
    { valor: 'disponivel', nome: 'Disponível' },
    { valor: 'emprestado', nome: 'Emprestado' },
    { valor: 'em_manutencao', nome: 'Manutenção' },
  ];

  alterar(campo: 'busca' | 'categoria' | 'status', evento: Event): void {
    const valor = (evento.target as HTMLInputElement | HTMLSelectElement).value;
    this[campo] = valor;
    this.filtrosChange.emit({
      busca: this.busca.trim() || undefined,
      categoria: (this.categoria || undefined) as CategoriaEquipamento | undefined,
      status: (this.status || undefined) as StatusEquipamento | undefined,
    });
  }
}