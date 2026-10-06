import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Emprestimo {
  id: number;
  item: string;
  responsavel: string;
  dataEmprestimo: string;
  dataPrevistaDevolucao: string;
  status: 'Ativo' | 'Atrasado' | 'Devolvido';
}

@Component({
  selector: 'app-admin-emprestimos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-emprestimos.html',
  styleUrl: './admin-emprestimos.css'
})
export class AdminEmprestimos {

  emprestimos: Emprestimo[] = [
    {
      id: 1,
      item: 'Notebook Dell',
      responsavel: 'João Silva',
      dataEmprestimo: '01/10/2026',
      dataPrevistaDevolucao: '10/10/2026',
      status: 'Ativo'
    },
    {
      id: 2,
      item: 'Projetor Epson',
      responsavel: 'Maria Santos',
      dataEmprestimo: '20/09/2026',
      dataPrevistaDevolucao: '30/09/2026',
      status: 'Atrasado'
    },
    {
      id: 3,
      item: 'Notebook Lenovo',
      responsavel: 'Carlos Souza',
      dataEmprestimo: '15/09/2026',
      dataPrevistaDevolucao: '25/09/2026',
      status: 'Devolvido'
    }
  ];

  get totalAtivos(): number {
    return this.emprestimos.filter(
      emprestimo => emprestimo.status === 'Ativo'
    ).length;
  }

  get totalAtrasados(): number {
    return this.emprestimos.filter(
      emprestimo => emprestimo.status === 'Atrasado'
    ).length;
  }

  get totalDevolvidos(): number {
    return this.emprestimos.filter(
      emprestimo => emprestimo.status === 'Devolvido'
    ).length;
  }
}