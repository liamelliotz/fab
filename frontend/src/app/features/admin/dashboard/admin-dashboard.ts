import {Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

// ESTRUTURA DAS MÉTRICAS ANALÍTICAS EXIBIDAS NO PAINEL DA COORDENAÇÃO ADMINISTRATIVA

export interface DashboardMetrics {
    totalEmprestados: number; //Total de materiais atualmente em epréstimo
    pedidosPendentes: number; //Quantidade de pedidos aguardando avaliação
    itensEmAtraso: number; //Quantidade de itens com devolução pendente/atrasados
    taxaOcupacaoRecursos: number; //Porcentagem da capacidade de recursos em uso
}

// ESTRUTURA PARA OS ITENS DA TABELA DE SOLICITAÇÕES RECENTES.

export interface SolicitacaoRecente {
    solicitante: string; // Nome do professor ou servidor solicitante
    data: string;
    setorOuDisciplina: string; 
    status: 'Em análise' | 'Aprovada' | 'Rejeitada';
}

@Component({
    selector: 'app-admin-dashboard',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './admin-dashboard.html',
    styleUrl: './admin-dashboard.css'
})
export class AdminDashboardComponent implements OnInit {
    // ESTADO INICIAL DAS MÉTRICAS ANALÍTICAS
metrics: DashboardMetrics = {
    totalEmprestados: 0,
    pedidosPendentes: 0,
    itensEmAtraso: 0,
    taxaOcupacaoRecursos: 0
};

// LISTA DE SOLICITAÇÕES DE PROFESSORES/SERVIDORES PARA ALIMENTAR A TABELA
solicitacoesRecentes: solicitacaoRecente [] = [];

//  FLAG DE CONTROLE PARA ESTADO DE CARREGAMENTO (LOADING)
isLoading = true;

ngOnInit(): void {
    this.loadData();
}

// MÉTODO RESPONSÁVEL POR BUSCAR DADOS DO DASHBOARD.
// Substituir o setTimeout pela chamada real ao serviço da API

private loadData(): void {
    setTimeout(() => {
        // Preenchimento de dados simulados (Mock) 
        this.metrics = {
            totalEmprestados: 142,
            pedidosPendentes: 12,
            itensEmAtraso: 7,
            taxaOcupacaoRecursos: 78.5
        };

        // Exemplo de lista contendo o setor ou disciplina do solicitante
       this.solicitacoesRecentes = [
        { solicitante: 'Profª. Eduarda Magalhães', data: '09/10/2026', setorOuDisciplina: 'Física', status: 'Em análise' },
        { solicitante: 'Prof. João Silva', data: '09/10/2026', setorOuDisciplina: 'Química', status: 'Em análise' },
        { solicitante: 'Maria Santos', data: '08/10/2026', setorOuDisciplina: 'Secretaria', status: 'Aprovada' },
        { solicitante: 'Prof. Nando Ferreira', data: '08/10/2026', setorOuDisciplina: 'Geografia', status: 'Aprovada' },
        { solicitante: 'Olivia Bittencourt', data: '07/10/2026', setorOuDisciplina: 'Biblioteca', status: 'Aprovada' },
        { solicitante: 'Prof. Pedro Oliveira', data: '07/10/2026', setorOuDisciplina: 'Artes', status: 'Rejeitada' },
        { solicitante: 'Liam Elliot', data: '06/10/2026', setorOuDisciplina: 'TI / Suporte', status: 'Rejeitada' }
      ];
      this.isLoading = false;
    }, 400);

}
   
}