import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Manutencao {
  id: number;
  item: string;
  patrimonio: string;
  problema: string;
  dataRegistro: string;
  assistencia: string;
  status: 'Avariado' | 'Em assistência' | 'Concluído';
}

@Component({
  selector: 'app-admin-manutencao',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-manutencao.html',
  styleUrl: './admin-manutencao.css'
})
export class AdminManutencao {

  manutencoes: Manutencao[] = [
    {
      id: 1,
      item: 'Notebook Dell',
      patrimonio: 'PAT-001',
      problema: 'Tela não liga',
      dataRegistro: '01/10/2026',
      assistencia: 'Tech Assistência',
      status: 'Em assistência'
    },
    {
      id: 2,
      item: 'Projetor Epson',
      patrimonio: 'PAT-002',
      problema: 'Imagem com falhas',
      dataRegistro: '02/10/2026',
      assistencia: 'Não enviada',
      status: 'Avariado'
    },
    {
      id: 3,
      item: 'Notebook Lenovo',
      patrimonio: 'PAT-003',
      problema: 'Problema no carregador',
      dataRegistro: '20/09/2026',
      assistencia: 'InfoTech',
      status: 'Concluído'
    }
  ];

  mostrarFormulario = false;

  novoRegistro: Manutencao = this.criarRegistroVazio();

  get totalAvariados(): number {
    return this.manutencoes.filter(
      manutencao => manutencao.status === 'Avariado'
    ).length;
  }

  get totalAssistencia(): number {
    return this.manutencoes.filter(
      manutencao => manutencao.status === 'Em assistência'
    ).length;
  }

  get totalConcluidos(): number {
    return this.manutencoes.filter(
      manutencao => manutencao.status === 'Concluído'
    ).length;
  }

  abrirFormulario(): void {
    this.mostrarFormulario = true;
  }

  cancelar(): void {
    this.mostrarFormulario = false;
    this.novoRegistro = this.criarRegistroVazio();
  }

  cadastrar(): void {
    if (
      !this.novoRegistro.item ||
      !this.novoRegistro.patrimonio ||
      !this.novoRegistro.problema
    ) {
      return;
    }

    const novo: Manutencao = {
      ...this.novoRegistro,
      id: this.proximoId()
    };

    this.manutencoes.push(novo);

    this.novoRegistro = this.criarRegistroVazio();
    this.mostrarFormulario = false;
  }

  avancarStatus(manutencao: Manutencao): void {
    if (manutencao.status === 'Avariado') {
      manutencao.status = 'Em assistência';
    } else if (manutencao.status === 'Em assistência') {
      manutencao.status = 'Concluído';
    }
  }

  private proximoId(): number {
    if (this.manutencoes.length === 0) {
      return 1;
    }

    return Math.max(...this.manutencoes.map(item => item.id)) + 1;
  }

  private criarRegistroVazio(): Manutencao {
    return {
      id: 0,
      item: '',
      patrimonio: '',
      problema: '',
      dataRegistro: '',
      assistencia: '',
      status: 'Avariado'
    };
  }
}