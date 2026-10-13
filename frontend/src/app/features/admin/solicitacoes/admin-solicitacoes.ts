import { Component, computed, signal } from '@angular/core';
import { Emprestimo, StatusEmprestimo } from '../../../core/models/emprestimo.model';

// Dados de exemplo até o backend/service existir
const SOLICITACOES_MOCK: Emprestimo[] = [
  {
    id: '1',
    protocolo: 'EMP-2026-0042',
    solicitante: { id: 'u1', nome: 'João Silva', email: 'joao@escola.br', perfil: 'usuario', departamento: 'Eletrônica' },
    itens: [{ equipamentoId: '1', quantidade: 2 }],
    status: 'pendente',
    justificativa: 'Montagem de circuito para o projeto integrador de robótica.',
    dataSolicitacao: '2026-10-10',
    dataPrevistaRetirada: '2026-10-14',
    dataPrevistaDevolucao: '2026-10-21',
  },
  {
    id: '2',
    protocolo: 'EMP-2026-0043',
    solicitante: { id: 'u2', nome: 'Maria Santos', email: 'maria@escola.br', perfil: 'usuario', departamento: 'Design' },
    itens: [{ equipamentoId: '5', quantidade: 1 }],
    status: 'pendente',
    justificativa: 'Corte de peças para maquete da feira de ciências.',
    dataSolicitacao: '2026-10-11',
    dataPrevistaRetirada: '2026-10-15',
    dataPrevistaDevolucao: '2026-10-18',
  },
  {
    id: '3',
    protocolo: 'EMP-2026-0044',
    solicitante: { id: 'u3', nome: 'Carlos Souza', email: 'carlos@escola.br', perfil: 'usuario', departamento: 'Mecânica' },
    itens: [{ equipamentoId: '3', quantidade: 1 }, { equipamentoId: '8', quantidade: 1 }],
    status: 'pendente',
    justificativa: 'Manutenção de bancada de testes.',
    dataSolicitacao: '2026-10-12',
    dataPrevistaRetirada: '2026-10-16',
    dataPrevistaDevolucao: '2026-10-23',
  },
  {
    id: '4',
    protocolo: 'EMP-2026-0040',
    solicitante: { id: 'u4', nome: 'Ana Lima', email: 'ana@escola.br', perfil: 'usuario', departamento: 'Eletrônica' },
    itens: [{ equipamentoId: '7', quantidade: 3 }],
    status: 'aprovado',
    justificativa: 'Aula prática de microcontroladores.',
    dataSolicitacao: '2026-10-05',
    dataPrevistaRetirada: '2026-10-08',
    dataPrevistaDevolucao: '2026-10-15',
    motivoRejeicao: undefined,
  },
];

const NOME_STATUS: Partial<Record<StatusEmprestimo, string>> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  rejeitado: 'Reprovado',
};

@Component({
  selector: 'app-admin-solicitacoes',
  standalone: true,
  templateUrl: './admin-solicitacoes.html',
  styleUrl: './admin-solicitacoes.css',
})
export class AdminSolicitacoes {
  private readonly todas = signal<Emprestimo[]>(SOLICITACOES_MOCK);

  readonly busca = signal('');
  readonly filtroStatus = signal<StatusEmprestimo | ''>('');

  // Solicitação em avaliação (abre o painel de justificativa)
  readonly selecionada = signal<Emprestimo | null>(null);
  readonly decisao = signal<'aprovar' | 'reprovar' | null>(null);
  readonly justificativa = signal('');
  readonly erro = signal('');

  readonly solicitacoes = computed(() => {
    const termo = this.busca().trim().toLowerCase();
    const status = this.filtroStatus();
    return this.todas().filter(
      (s) =>
        (!termo ||
          s.protocolo.toLowerCase().includes(termo) ||
          s.solicitante.nome.toLowerCase().includes(termo)) &&
        (!status || s.status === status),
    );
  });

  nomeStatus(status: StatusEmprestimo): string {
    return NOME_STATUS[status] ?? status;
  }

  total(s: Emprestimo): number {
    return s.itens.reduce((soma, i) => soma + i.quantidade, 0);
  }

  atualizarBusca(evento: Event): void {
    this.busca.set((evento.target as HTMLInputElement).value);
  }

  atualizarStatus(evento: Event): void {
    this.filtroStatus.set((evento.target as HTMLSelectElement).value as StatusEmprestimo | '');
  }

  atualizarJustificativa(evento: Event): void {
    this.justificativa.set((evento.target as HTMLTextAreaElement).value);
  }

  iniciar(s: Emprestimo, decisao: 'aprovar' | 'reprovar'): void {
    this.selecionada.set(s);
    this.decisao.set(decisao);
    this.justificativa.set('');
    this.erro.set('');
  }

  cancelar(): void {
    this.selecionada.set(null);
    this.decisao.set(null);
    this.erro.set('');
  }

  confirmar(): void {
    const alvo = this.selecionada();
    const decisao = this.decisao();
    const texto = this.justificativa().trim();
    if (!alvo || !decisao) return;

    if (!texto) {
      this.erro.set('Informe uma justificativa para registrar a decisão.');
      return;
    }

    const aprovado = decisao === 'aprovar';
    this.todas.update((lista) =>
      lista.map((s) =>
        s.id === alvo.id
          ? {
              ...s,
              status: aprovado ? 'aprovado' : 'rejeitado',
              motivoRejeicao: aprovado ? undefined : texto,
            }
          : s,
      ),
    );
    this.cancelar();
  }
}