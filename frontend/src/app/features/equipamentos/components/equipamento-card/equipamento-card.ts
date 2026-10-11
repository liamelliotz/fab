import { Component, Input } from '@angular/core';
import { Card } from '../../../../shared/components/card/card';
import {
  BadgeStatus,
  StatusEquipamento as StatusBadge,
} from '../../../../shared/components/badge-status/badge-status';
import {
  CategoriaEquipamento,
  Equipamento,
  StatusEquipamento,
} from '../../../../core/models/equipamento.model';

const STATUS_PARA_BADGE: Record<StatusEquipamento, StatusBadge> = {
  disponivel: 'Disponível',
  emprestado: 'Emprestado',
  em_manutencao: 'Manutenção',
  inativo: 'Pendente',
  descartado: 'Pendente',
};

const NOME_CATEGORIA: Record<CategoriaEquipamento, string> = {
  ferramenta: 'Ferramenta',
  eletronico: 'Eletrônico',
  impressora_3d: 'Impressora 3D',
  corte_laser: 'Corte a laser',
  consumivel: 'Consumível',
  outros: 'Outros',
};

@Component({
  selector: 'app-equipamento-card',
  standalone: true,
  imports: [Card, BadgeStatus],
  templateUrl: './equipamento-card.html',
  styleUrl: './equipamento-card.css',
})
export class EquipamentoCard {
  @Input({ required: true }) equipamento!: Equipamento;

  get statusBadge(): StatusBadge {
    return STATUS_PARA_BADGE[this.equipamento.status];
  }

  get nomeCategoria(): string {
    return NOME_CATEGORIA[this.equipamento.categoria];
  }
}