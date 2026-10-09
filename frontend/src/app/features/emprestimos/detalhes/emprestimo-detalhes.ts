import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

// INTERFACES/ TIPAGEM DE DADOS 

//Interface para os dados dos dados do requerente Professor(a) ou Funcionário(a)
export interface RequerenteEscolar {
    nome: string;
    email: string;
    cargo: string; //ex: professor(a) ou Coordenador(a)
    setorOuDisciplina: string; //ex: matemática ou laboratório de ciências
    matricula: string; //matrícula/id na instituição
}
//Interface para o cronograma de datas do empréstimo
export interface CronogramaDatas {
    dataSolicitacao: string;
    dataPrevistaRetirada: string;
    dataPrevistaDevolucao: string;
}
//interface para os termos de responsabilidade 
export interface TermoResposabilidade {
    id: number;
    titulo: string;
    versao: string;
    aceitoEm: string;
}
//interface para cada evento do histórico
export interface EventoTimeLine {
    titulo: string;
    descricao: string;
    dataHora: string;
    status: 'Concluido' | 'Em_andamento' | 'Pendente';
}//interface principal que agrupa todas as informações do comprovante
export interface EmprestimoDetalhes {
    id: string;
    statusGeral: string;
    requerente: RequerenteEscolar;
    cronograma: CronogramaDatas;
    termos: TermoResposabilidade[];
    linhaDoTempo: EventoTimeLine[];
}

// COMPONENTE ANGULAR
@Component({
    selector: 'app-emprestimo-detalhes',
    standalone: true,
    imports: [CommonModule], //necessário para diretivas como *ngFor e *ngClass
    templateUrl: './emprestimo-detalhes.html',
    styleUrls: ['./emprestimo-detalhes.css']
})
export class EmprestimoDetalhesComponent implements OnInit {
    //Objeto 'emprestimo' com dados simulados (mock) 
    public emprestimo: EmprestimoDetalhes = {
        id: 'REQ-2026-0892',
        statusGeral: 'Em andamento',

        // 1. Dados do requerente (Docente/funcionario)
        requerente: {
            nome: 'Prof. Carlos Eduardo Santos',
            email: 'carlos.santos@escola.edu.br',
            cargo: 'Professor',
            setorOuDisciplina: 'Ciências e biologia / ensino fundamental II',
            matricula: 'FUNC-2024-8841'
        },
        // 2. Cronograma de datas
        cronograma: {
            dataSolicitacao: '101/10/2026 às 09:30',
            dataPrevistaRetirada: '02/10/2026 às 14:00',
            dataPrevistaDevolucao: '15/10/2026 às 18:00'
        },
        
        // 3. Termos de responsabilidade 
        termos: [
            {
                id: 101,
                titulo: 'Termo de responsabilidade e conservação de equipamentos didáticos',
                versao: 'v2.0',
                aceitoEm: '01/10/2026 às 09:30'
            }
        ],

        // 4. Linha do tempo de eventos do pedido
        linhaDoTempo: [
            {
                titulo: 'Solicitação criada',
                descricao: 'Requisição cadastrada pelo docente no sistema de materiais.',
                dataHora: '01/10/2026 - 09:30',
                status: 'Concluido'
            },
            {
                titulo: 'Devolução pendente',
                descricao: 'Aguardando devolução ao término do período do empréstimo.',
                dataHora: 'Previsto para 15/10/2026',
                status: 'Pendente'
            }
        ]
    };
    constructor() {}
    //método onrigatório devido ao 'implements OnInit'
    ngOnInit(): void{

    }
}