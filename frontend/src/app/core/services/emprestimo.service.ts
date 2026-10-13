import { Injectable, computed, inject, signal } from '@angular/core';
import { Emprestimo, SolicitarEmprestimoDTO, StatusEmprestimo } from '../models/emprestimo.model';
import { UsuarioResumo } from '../models/usuario.model';
import { hojeISO } from '../utils/date.utils';
import { EquipamentoService } from './equipamento.service';

export const NOME_STATUS_EMPRESTIMO: Record<StatusEmprestimo, string> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  rejeitado: 'Reprovado',
  em_andamento: 'Em andamento',
  devolvido: 'Devolvido',
  atrasado: 'Atrasado',
  cancelado: 'Cancelado',
};

// Dados de exemplo até o backend existir
const EMPRESTIMOS_MOCK: Emprestimo[] = [
  {
    id: '1',
    protocolo: 'EMP-2026-0042',
    solicitante: { id: 'u1', nome: 'João Silva', email: 'joao@escola.br', perfil: 'usuario', departamento: 'Informática' },
    itens: [{ equipamentoId: '1', quantidade: 2 }],
    status: 'pendente',
    justificativa: 'Aula prática de lógica de programação com a turma do 2º módulo.',
    dataSolicitacao: '2026-10-10',
    dataPrevistaRetirada: '2026-10-14',
    dataPrevistaDevolucao: '2026-10-21',
  },
  {
    id: '2',
    protocolo: 'EMP-2026-0043',
    solicitante: { id: 'u2', nome: 'Maria Santos', email: 'maria@escola.br', perfil: 'usuario', departamento: 'Secretaria' },
    itens: [{ equipamentoId: '2', quantidade: 1 }],
    status: 'pendente',
    justificativa: 'Projeção de apresentação na reunião de pais e mestres.',
    dataSolicitacao: '2026-10-11',
    dataPrevistaRetirada: '2026-10-15',
    dataPrevistaDevolucao: '2026-10-18',
  },
  {
    id: '3',
    protocolo: 'EMP-2026-0044',
    solicitante: { id: 'u3', nome: 'Carlos Souza', email: 'carlos@escola.br', perfil: 'usuario', departamento: 'Eletrônica' },
    itens: [
      { equipamentoId: '5', quantidade: 1 },
      { equipamentoId: '6', quantidade: 1 },
    ],
    status: 'pendente',
    justificativa: 'Manutenção da bancada de testes do laboratório.',
    dataSolicitacao: '2026-10-12',
    dataPrevistaRetirada: '2026-10-16',
    dataPrevistaDevolucao: '2026-10-23',
  },
  {
    id: '4',
    protocolo: 'EMP-2026-0040',
    solicitante: { id: 'u4', nome: 'Ana Lima', email: 'ana@escola.br', perfil: 'usuario', departamento: 'Informática' },
    itens: [{ equipamentoId: '3', quantidade: 2 }],
    status: 'aprovado',
    justificativa: 'Oficina de desenvolvimento web.',
    dataSolicitacao: '2026-10-05',
    dataPrevistaRetirada: '2026-10-08',
    dataPrevistaDevolucao: '2026-10-15',
  },
  {
    id: '5',
    protocolo: 'EMP-2026-0038',
    solicitante: { id: 'demo-professor', nome: 'Professor Demonstração', email: 'professor@fab.com', perfil: 'usuario', departamento: 'Docência' },
    itens: [{ equipamentoId: '4', quantidade: 1 }],
    status: 'devolvido',
    justificativa: 'Som para a apresentação da feira de ciências.',
    dataSolicitacao: '2026-09-28',
    dataPrevistaRetirada: '2026-09-30',
    dataPrevistaDevolucao: '2026-10-02',
    dataDevolucaoEfetiva: '2026-10-02',
  },
  {
    id: '6',
    protocolo: 'EMP-2026-0039',
    solicitante: { id: 'demo-professor', nome: 'Professor Demonstração', email: 'professor@fab.com', perfil: 'usuario', departamento: 'Docência' },
    itens: [{ equipamentoId: '8', quantidade: 1 }],
    status: 'rejeitado',
    justificativa: 'Impressão de peças para o projeto integrador.',
    dataSolicitacao: '2026-10-01',
    dataPrevistaRetirada: '2026-10-05',
    dataPrevistaDevolucao: '2026-10-12',
    motivoRejeicao: 'Equipamento exige treinamento prévio, ainda não comprovado.',
  },
];

@Injectable({ providedIn: 'root' })
export class EmprestimoService {
  private readonly equipamentos = inject(EquipamentoService);

  readonly todas = signal<Emprestimo[]>(EMPRESTIMOS_MOCK);

  readonly pendentes = computed(() => this.todas().filter((s) => s.status === 'pendente'));

  readonly ativos = computed(() =>
    this.todas().filter((s) => s.status === 'aprovado' || s.status === 'em_andamento'),
  );

  /** Ex.: "Notebook Dell Inspiron 15 × 2, Projetor Epson PowerLite × 1" */
  resumoItens(s: Emprestimo): string {
    return s.itens
      .map(
        (i) =>
          `${this.equipamentos.buscarPorId(i.equipamentoId)?.nome ?? 'Item removido'} × ${i.quantidade}`,
      )
      .join(', ');
  }

  totalUnidades(s: Emprestimo): number {
    return s.itens.reduce((soma, i) => soma + i.quantidade, 0);
  }

  /** Aprovado/em andamento com a data de devolução já vencida. */
  estaAtrasado(s: Emprestimo): boolean {
    return (
      (s.status === 'aprovado' || s.status === 'em_andamento') &&
      s.dataPrevistaDevolucao < hojeISO()
    );
  }

  /** Cria uma nova solicitação pendente. */
  solicitar(dto: SolicitarEmprestimoDTO, solicitante: UsuarioResumo): Emprestimo {
    const novo: Emprestimo = {
      id: crypto.randomUUID(),
      protocolo: this.proximoProtocolo(),
      solicitante,
      itens: dto.itens.map((i) => ({
        equipamentoId: i.equipamentoId,
        quantidade: i.quantidade,
        observacoes: i.observacoes,
      })),
      status: 'pendente',
      justificativa: dto.justificativa,
      dataSolicitacao: hojeISO(),
      dataPrevistaRetirada: dto.dataPrevistaRetirada,
      dataPrevistaDevolucao: dto.dataPrevistaDevolucao,
    };
    this.todas.update((lista) => [novo, ...lista]);
    return novo;
  }

  /** Aprova ou reprova. Devolve uma mensagem de erro, ou null se deu certo. */
  avaliar(id: string, aprovado: boolean, texto: string): string | null {
    const alvo = this.todas().find((s) => s.id === id);
    if (!alvo || alvo.status !== 'pendente') {
      return 'Esta solicitação não está mais pendente.';
    }

    if (aprovado) {
      for (const item of alvo.itens) {
        const eq = this.equipamentos.buscarPorId(item.equipamentoId);
        if (!eq || eq.status !== 'disponivel' || eq.quantidadeDisponivel < item.quantidade) {
          return `Estoque insuficiente para "${eq?.nome ?? 'um dos itens'}".`;
        }
      }
      alvo.itens.forEach((i) => this.equipamentos.reservar(i.equipamentoId, i.quantidade));
    }

    this.todas.update((lista) =>
      lista.map(
        (s): Emprestimo =>
          s.id === id
            ? {
                ...s,
                status: aprovado ? 'aprovado' : 'rejeitado',
                motivoRejeicao: aprovado ? undefined : texto,
              }
            : s,
      ),
    );
    return null;
  }

  /** O próprio solicitante cancela um pedido que ainda está pendente. */
  cancelar(id: string): void {
    this.todas.update((lista) =>
      lista.map((s): Emprestimo => (s.id === id && s.status === 'pendente' ? { ...s, status: 'cancelado' } : s)),
    );
  }

  private proximoProtocolo(): string {
    const maior = this.todas().reduce(
      (m, s) => Math.max(m, Number(s.protocolo.slice(-4)) || 0),
      0,
    );
    return `EMP-${new Date().getFullYear()}-${String(maior + 1).padStart(4, '0')}`;
  }
}
