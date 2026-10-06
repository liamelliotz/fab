import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface UtilizacaoMaterial {
  id: number;
  material: string;
  responsavel: string;
  data: string;
  quantidade: number;
  tipo: string;
}

@Component({
  selector: 'app-admin-relatorios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-relatorios.html',
  styleUrl: './admin-relatorios.css'
})
export class AdminRelatorios {

  dataInicial = '';
  dataFinal = '';
  relatorioGerado = false;

  utilizacoes: UtilizacaoMaterial[] = [
    {
      id: 1,
      material: 'Notebook Dell',
      responsavel: 'João Silva',
      data: '2026-09-20',
      quantidade: 1,
      tipo: 'Empréstimo'
    },
    {
      id: 2,
      material: 'Projetor Epson',
      responsavel: 'Maria Santos',
      data: '2026-09-25',
      quantidade: 1,
      tipo: 'Empréstimo'
    },
    {
      id: 3,
      material: 'Notebook Lenovo',
      responsavel: 'Carlos Souza',
      data: '2026-10-01',
      quantidade: 1,
      tipo: 'Empréstimo'
    },
    {
      id: 4,
      material: 'Kit de ferramentas',
      responsavel: 'Ana Lima',
      data: '2026-10-02',
      quantidade: 2,
      tipo: 'Utilização'
    },
    {
      id: 5,
      material: 'Multímetro Digital',
      responsavel: 'Pedro Alves',
      data: '2026-10-03',
      quantidade: 1,
      tipo: 'Utilização'
    }
  ];

  resultados: UtilizacaoMaterial[] = [];

  gerarRelatorio(): void {

    if (!this.dataInicial || !this.dataFinal) {
      alert('Informe a data inicial e a data final.');
      return;
    }

    if (this.dataInicial > this.dataFinal) {
      alert('A data inicial não pode ser maior que a data final.');
      return;
    }

    this.resultados = this.utilizacoes.filter(utilizacao =>
      utilizacao.data >= this.dataInicial &&
      utilizacao.data <= this.dataFinal
    );

    this.relatorioGerado = true;
  }

  limparRelatorio(): void {
    this.dataInicial = '';
    this.dataFinal = '';
    this.resultados = [];
    this.relatorioGerado = false;
  }

  get totalRegistros(): number {
    return this.resultados.length;
  }

  get totalQuantidade(): number {
    return this.resultados.reduce(
      (total, item) => total + item.quantidade,
      0
    );
  }

  get materiaisDiferentes(): number {
    return new Set(
      this.resultados.map(item => item.material)
    ).size;
  }

  exportarCSV(): void {

    if (this.resultados.length === 0) {
      alert('Não existem dados para exportar.');
      return;
    }

    const cabecalho = [
      'ID',
      'Material',
      'Responsavel',
      'Data',
      'Quantidade',
      'Tipo'
    ];

    const linhas = this.resultados.map(item => [
      item.id,
      item.material,
      item.responsavel,
      item.data,
      item.quantidade,
      item.tipo
    ]);

    const conteudo = [
      cabecalho,
      ...linhas
    ]
      .map(linha =>
        linha
          .map(valor => `"${String(valor).replace(/"/g, '""')}"`)
          .join(';')
      )
      .join('\n');

    const blob = new Blob(
      ['\uFEFF' + conteudo],
      { type: 'text/csv;charset=utf-8;' }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');

    link.href = url;
    link.download =
      `relatorio-utilizacao-${this.dataInicial}-${this.dataFinal}.csv`;

    link.click();

    URL.revokeObjectURL(url);
  }
}