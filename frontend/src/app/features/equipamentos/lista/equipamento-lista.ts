import { Component, computed, signal } from '@angular/core';
import { Equipamento, FiltroEquipamentoDTO } from '../../../core/models/equipamento.model';
import { EquipamentoCard } from '../components/equipamento-card/equipamento-card';
import { EquipamentoFiltros } from '../components/equipamento-filtros/equipamento-filtros';

// Dados de exemplo até o backend/service existir
const EQUIPAMENTOS_MOCK: Equipamento[] = [
  { id: '1', nome: 'Multímetro Digital Minipa ET-1002', descricao: 'Multímetro de bancada', codigoPatrimonio: 'PAT-0001', categoria: 'eletronico', status: 'disponivel', localizacao: 'Bancada 03 - Gaveteiro B', requerTreinamento: false, quantidadeDisponivel: 4, quantidadeTotal: 5, criadoEm: '2026-09-01' },
  { id: '2', nome: 'Osciloscópio Rigol DS1054Z', descricao: 'Osciloscópio 4 canais', codigoPatrimonio: 'PAT-0002', categoria: 'eletronico', status: 'emprestado', localizacao: 'Bancada 01', requerTreinamento: true, quantidadeDisponivel: 0, quantidadeTotal: 1, criadoEm: '2026-09-01' },
  { id: '3', nome: 'Parafusadeira Bosch 12V', descricao: 'Parafusadeira a bateria', codigoPatrimonio: 'PAT-0003', categoria: 'ferramenta', status: 'disponivel', localizacao: 'Armário 02', requerTreinamento: false, quantidadeDisponivel: 3, quantidadeTotal: 3, criadoEm: '2026-09-02' },
  { id: '4', nome: 'Impressora 3D Creality Ender 3', descricao: 'Impressora FDM', codigoPatrimonio: 'PAT-0004', categoria: 'impressora_3d', status: 'em_manutencao', localizacao: 'Sala de Prototipagem', requerTreinamento: true, quantidadeDisponivel: 0, quantidadeTotal: 2, criadoEm: '2026-09-03' },
  { id: '5', nome: 'Cortadora a Laser 40W', descricao: 'Corte e gravação', codigoPatrimonio: 'PAT-0005', categoria: 'corte_laser', status: 'disponivel', localizacao: 'Sala de Prototipagem', requerTreinamento: true, quantidadeDisponivel: 1, quantidadeTotal: 1, criadoEm: '2026-09-03' },
  { id: '6', nome: 'Filamento PLA 1kg (branco)', descricao: 'Filamento para impressão', codigoPatrimonio: 'PAT-0006', categoria: 'consumivel', status: 'disponivel', localizacao: 'Estante 01', requerTreinamento: false, quantidadeDisponivel: 8, quantidadeTotal: 10, criadoEm: '2026-09-04' },
  { id: '7', nome: 'Arduino Uno R3', descricao: 'Microcontrolador', codigoPatrimonio: 'PAT-0007', categoria: 'eletronico', status: 'emprestado', localizacao: 'Gaveteiro A', requerTreinamento: false, quantidadeDisponivel: 2, quantidadeTotal: 10, criadoEm: '2026-09-05' },
  { id: '8', nome: 'Kit de Chaves de Precisão', descricao: 'Kit com 32 peças', codigoPatrimonio: 'PAT-0008', categoria: 'ferramenta', status: 'disponivel', localizacao: 'Armário 02', requerTreinamento: false, quantidadeDisponivel: 5, quantidadeTotal: 5, criadoEm: '2026-09-05' },
];

@Component({
  selector: 'app-equipamento-lista',
  standalone: true,
  imports: [EquipamentoCard, EquipamentoFiltros],
  templateUrl: './equipamento-lista.html',
  styleUrl: './equipamento-lista.css',
})
export class EquipamentoLista {
  private readonly todos = signal<Equipamento[]>(EQUIPAMENTOS_MOCK);
  readonly filtros = signal<FiltroEquipamentoDTO>({});

  readonly equipamentos = computed(() => {
    const { busca, categoria, status } = this.filtros();
    const termo = busca?.toLowerCase();
    return this.todos().filter(
      (e) =>
        (!termo ||
          e.nome.toLowerCase().includes(termo) ||
          e.codigoPatrimonio.toLowerCase().includes(termo)) &&
        (!categoria || e.categoria === categoria) &&
        (!status || e.status === status),
    );
  });
}