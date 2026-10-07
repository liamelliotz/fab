import { Component, computed, input } from '@angular/core';
import type { StatusEquipamento } from '../../../core/models/equipamento.model';
import type { StatusEmprestimo } from '../../../core/models/emprestimo.model';

/** Estados exibidos pelo badge: Disponível, Emprestado, Manutenção e Pendente. */
export type StatusBadge =
  | Extract<StatusEquipamento, 'disponivel' | 'emprestado' | 'em_manutencao'>
  | Extract<StatusEmprestimo, 'pendente'>;

const ROTULOS: Record<StatusBadge, string> = {
  disponivel: 'Disponível',
  emprestado: 'Emprestado',
  em_manutencao: 'Manutenção',
  pendente: 'Pendente',
};

@Component({
  selector: 'app-badge-status',
  imports: [],
  templateUrl: './badge-status.html',
  styleUrl: './badge-status.css',
})
export class BadgeStatus {
  readonly status = input.required<StatusBadge>();
  protected readonly rotulo = computed(() => ROTULOS[this.status()]);
}