import { Component, Input } from '@angular/core';

export type StatusEquipamento =
  | 'Disponível'
  | 'Emprestado'
  | 'Manutenção'
  | 'Pendente';

@Component({
  selector: 'app-badge-status',
  standalone: true,
  templateUrl: './badge-status.html',
  styleUrl: './badge-status.css',
})
export class BadgeStatus {
  @Input() status: StatusEquipamento = 'Pendente';
}