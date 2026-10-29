import { Injectable, computed, effect, signal } from '@angular/core';
import {
  CategoriaEquipamento,
  CriarEquipamentoDTO,
  Equipamento,
  StatusEquipamento,
} from '../models/equipamento.model';
import { gravarJson, lerJson } from '../utils/armazenamento.utils';

const CHAVE_EQUIPAMENTOS = 'fab_demo_v3_equipamentos';

export const CATEGORIAS: { valor: CategoriaEquipamento; nome: string }[] = [
  { valor: 'ferramenta', nome: 'Ferramenta' },
  { valor: 'eletronico', nome: 'Eletrônico' },
  { valor: 'impressora_3d', nome: 'Impressora 3D' },
  { valor: 'corte_laser', nome: 'Corte a laser' },
  { valor: 'consumivel', nome: 'Consumível' },
  { valor: 'outros', nome: 'Outros' },
];

export const NOME_STATUS_EQUIPAMENTO: Record<StatusEquipamento, string> = {
  disponivel: 'Disponível',
  emprestado: 'Emprestado',
  em_manutencao: 'Em manutenção',
  inativo: 'Inativo',
  descartado: 'Descartado',
};

// Fonte única para Materiais, Equipamentos e Dashboard até o backend existir.
/** Material de exemplo. Gerado por função para a demonstração poder voltar ao estado inicial. */
export function criarEquipamentosDemo(): Equipamento[] {
  return [
    {
      id: '1',
      nome: 'Notebook Dell Inspiron 15',
      descricao: 'Notebook para aulas e atividades, acompanha carregador.',
      codigoPatrimonio: 'PAT-0001',
      categoria: 'eletronico',
      status: 'disponivel',
      localizacao: 'Armário de TI - Prateleira 1',
      requerTreinamento: false,
      prazoMaximoDias: 7,
      quantidadeDisponivel: 7,
      quantidadeTotal: 10,
      criadoEm: '2026-08-01',
    },
    {
      id: '2',
      nome: 'Projetor Epson PowerLite',
      descricao: 'Projetor com cabo HDMI e controle remoto.',
      codigoPatrimonio: 'PAT-0002',
      categoria: 'eletronico',
      status: 'disponivel',
      localizacao: 'Armário de TI - Prateleira 2',
      requerTreinamento: false,
      prazoMaximoDias: 3,
      quantidadeDisponivel: 2,
      quantidadeTotal: 4,
      criadoEm: '2026-08-01',
    },
    {
      id: '3',
      nome: 'Notebook Lenovo IdeaPad 3',
      descricao: 'Notebook para aulas e atividades, acompanha carregador.',
      codigoPatrimonio: 'PAT-0003',
      categoria: 'eletronico',
      status: 'disponivel',
      localizacao: 'Armário de TI - Prateleira 1',
      requerTreinamento: false,
      prazoMaximoDias: 7,
      quantidadeDisponivel: 6,
      quantidadeTotal: 8,
      criadoEm: '2026-08-03',
    },
    {
      id: '4',
      nome: 'Caixa de som Bluetooth',
      descricao: 'Caixa de som portátil para eventos e aulas.',
      codigoPatrimonio: 'PAT-0004',
      categoria: 'eletronico',
      status: 'disponivel',
      localizacao: 'Armário de TI - Prateleira 3',
      requerTreinamento: false,
      prazoMaximoDias: 3,
      quantidadeDisponivel: 2,
      quantidadeTotal: 3,
      criadoEm: '2026-08-05',
    },
    {
      id: '5',
      nome: 'Multímetro Digital Minipa ET-1002',
      descricao: 'Multímetro de bancada, 600 V.',
      codigoPatrimonio: 'PAT-0005',
      categoria: 'eletronico',
      status: 'disponivel',
      localizacao: 'Bancada 03 - Gaveteiro B',
      requerTreinamento: false,
      prazoMaximoDias: 7,
      quantidadeDisponivel: 4,
      quantidadeTotal: 5,
      criadoEm: '2026-08-10',
    },
    {
      id: '6',
      nome: 'Kit de ferramentas de precisão',
      descricao: 'Kit com 32 peças para manutenção de eletrônicos.',
      codigoPatrimonio: 'PAT-0006',
      categoria: 'ferramenta',
      status: 'disponivel',
      localizacao: 'Armário 02',
      requerTreinamento: false,
      prazoMaximoDias: 15,
      quantidadeDisponivel: 4,
      quantidadeTotal: 5,
      criadoEm: '2026-08-12',
    },
    {
      id: '7',
      nome: 'Parafusadeira Bosch 12 V',
      descricao: 'Parafusadeira sem fio com 2 baterias.',
      codigoPatrimonio: 'PAT-0007',
      categoria: 'ferramenta',
      status: 'em_manutencao',
      localizacao: 'Armário 01',
      requerTreinamento: false,
      prazoMaximoDias: 7,
      quantidadeDisponivel: 0,
      quantidadeTotal: 2,
      criadoEm: '2026-08-12',
    },
    {
      id: '8',
      nome: 'Impressora 3D Creality Ender 3 V2',
      descricao: 'Impressora FDM, mesa 220x220 mm.',
      codigoPatrimonio: 'PAT-0008',
      categoria: 'impressora_3d',
      status: 'disponivel',
      localizacao: 'Sala de prototipagem',
      requerTreinamento: true,
      prazoMaximoDias: 5,
      quantidadeDisponivel: 1,
      quantidadeTotal: 2,
      criadoEm: '2026-08-20',
    },
    {
      id: '9',
      nome: 'Cortadora a laser CO2 40 W',
      descricao: 'Área de corte 300x200 mm.',
      codigoPatrimonio: 'PAT-0009',
      categoria: 'corte_laser',
      status: 'inativo',
      localizacao: 'Sala de corte',
      requerTreinamento: true,
      prazoMaximoDias: 3,
      quantidadeDisponivel: 0,
      quantidadeTotal: 1,
      criadoEm: '2026-08-22',
    },
    {
      id: '10',
      nome: 'Osciloscópio Rigol DS1054Z',
      descricao: 'Osciloscópio de 4 canais.',
      codigoPatrimonio: 'PAT-0010',
      categoria: 'eletronico',
      status: 'emprestado',
      localizacao: 'Bancada 01',
      requerTreinamento: true,
      prazoMaximoDias: 7,
      quantidadeDisponivel: 0,
      quantidadeTotal: 1,
      criadoEm: '2026-09-01',
    },
  ];
}

@Injectable({ providedIn: 'root' })
export class EquipamentoService {
  /** Todos os itens (inclui inativos) – usado pela área administrativa. */
  readonly itens = signal<Equipamento[]>(
    lerJson<Equipamento[]>(CHAVE_EQUIPAMENTOS) ?? criarEquipamentosDemo(),
  );

  /** Itens visíveis no catálogo de Materiais (sem inativos nem descartados). */
  readonly catalogo = computed(() =>
    this.itens().filter((e) => e.status !== 'inativo' && e.status !== 'descartado'),
  );

  /** Total de unidades prontas para empréstimo. */
  readonly unidadesDisponiveis = computed(() =>
    this.catalogo()
      .filter((e) => e.status === 'disponivel')
      .reduce((soma, e) => soma + e.quantidadeDisponivel, 0),
  );

  /** Quantidade de itens em manutenção. */
  readonly emManutencao = computed(
    () => this.itens().filter((e) => e.status === 'em_manutencao').length,
  );

  constructor() {
    // Grava a cada mudança: a demonstração continua de onde parou depois de recarregar a página.
    effect(() => gravarJson(CHAVE_EQUIPAMENTOS, this.itens()));
  }

  buscarPorId(id: string): Equipamento | undefined {
    return this.itens().find((e) => e.id === id);
  }

  // Verdadeiro se o código já pertence a outro equipamento
  codigoExiste(codigo: string, ignorarId?: string): boolean {
    const alvo = codigo.trim().toLowerCase();
    return this.itens().some(
      (e) => e.id !== ignorarId && e.codigoPatrimonio.trim().toLowerCase() === alvo,
    );
  }

  cadastrar(dto: CriarEquipamentoDTO): void {
    const novo: Equipamento = {
      ...dto,
      id: crypto.randomUUID(),
      status: 'disponivel',
      quantidadeDisponivel: dto.quantidadeTotal,
      criadoEm: new Date().toISOString().slice(0, 10),
    };
    this.itens.update((lista) => [...lista, novo]);
  }

  atualizar(id: string, dados: Partial<Omit<Equipamento, 'id'>>): void {
    const hoje = new Date().toISOString().slice(0, 10);
    this.itens.update((lista) =>
      lista.map((e) => {
        if (e.id !== id) return e;
        const novo: Equipamento = { ...e, ...dados, atualizadoEm: hoje };
        // Se voltou a ter saldo, deixa de aparecer como "emprestado"
        if (novo.status === 'emprestado' && novo.quantidadeDisponivel > 0) {
          novo.status = 'disponivel';
        }
        return novo;
      }),
    );
  }

  // Desativa (inativo) ou reativa (disponivel). Item emprestado não muda.
  alternarAtivo(id: string): void {
    const item = this.buscarPorId(id);
    if (!item || item.status === 'emprestado') return;
    this.atualizar(id, { status: item.status === 'inativo' ? 'disponivel' : 'inativo' });
  }

  /** Separa unidades para um empréstimo aprovado. Devolve false se não houver saldo. */
  reservar(id: string, quantidade: number): boolean {
    const item = this.buscarPorId(id);
    if (!item || item.status !== 'disponivel' || item.quantidadeDisponivel < quantidade) {
      return false;
    }
    const restante = item.quantidadeDisponivel - quantidade;
    this.atualizar(id, {
      quantidadeDisponivel: restante,
      status: restante === 0 ? 'emprestado' : 'disponivel',
    });
    return true;
  }

  /**
   * Devolve unidades ao estoque (devolução ou cancelamento de um pedido aprovado).
   * Nunca passa do total cadastrado. Item inativo ou em manutenção continua como está.
   */
  liberar(id: string, quantidade: number): void {
    const item = this.buscarPorId(id);
    if (!item) return;
    const disponivel = Math.min(item.quantidadeTotal, item.quantidadeDisponivel + quantidade);
    this.atualizar(id, {
      quantidadeDisponivel: disponivel,
      status: item.status === 'emprestado' && disponivel > 0 ? 'disponivel' : item.status,
    });
  }

  /** Volta o acervo ao estado inicial da demonstração. */
  reiniciar(): void {
    this.itens.set(criarEquipamentosDemo());
  }
}
