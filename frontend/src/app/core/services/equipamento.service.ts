import { Injectable, computed, effect, signal } from '@angular/core';
import {
  CategoriaEquipamento,
  CriarEquipamentoDTO,
  Equipamento,
  StatusEquipamento,
} from '../models/equipamento.model';
import { gravarJson, lerJson, ouvirOutrasAbas } from '../utils/armazenamento.utils';

const CHAVE_EQUIPAMENTOS = 'fab_demo_v5_equipamentos';

export const CATEGORIAS: { valor: CategoriaEquipamento; nome: string }[] = [
  { valor: 'ferramenta', nome: 'Ferramenta' },
  { valor: 'eletronico', nome: 'Eletrônico' },
  { valor: 'impressora_3d', nome: 'Impressora 3D' },
  { valor: 'corte_laser', nome: 'Corte a laser' },
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
// O estoque bate com os pedidos de exemplo: emprestadas = total - disponíveis - em manutenção,
// e cada unidade emprestada pertence a um pedido aprovado ou em andamento de criarEmprestimosDemo().
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
      quantidadeDisponivel: 10,
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
      quantidadeDisponivel: 3,
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
      quantidadeEmManutencao: 2, // as duas estão na assistência (ver ManutencaoService)
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
      quantidadeDisponivel: 1,
      quantidadeTotal: 1,
      criadoEm: '2026-08-22',
    },
    {
      id: '10',
      nome: 'Osciloscópio Rigol DS1054Z',
      descricao: 'Osciloscópio de 4 canais.',
      codigoPatrimonio: 'PAT-0010',
      categoria: 'eletronico',
      status: 'disponivel',
      localizacao: 'Bancada 01',
      requerTreinamento: true,
      prazoMaximoDias: 7,
      quantidadeDisponivel: 1,
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

  /** Unidades fora do estoque por avaria ou extravio (somando todos os itens). */
  readonly emManutencao = computed(() =>
    this.itens().reduce((soma, e) => soma + (e.quantidadeEmManutencao ?? 0), 0),
  );

  constructor() {
    // Grava a cada mudança: a demonstração continua de onde parou depois de recarregar a página.
    effect(() => gravarJson(CHAVE_EQUIPAMENTOS, this.itens()));
    ouvirOutrasAbas<Equipamento[]>(CHAVE_EQUIPAMENTOS, (v) => v && this.itens.set(v));
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

  // ===========================================================================================
  // Estoque: cada unidade está em UMA destas situações
  //   disponível (pode ser emprestada) · emprestada · em manutenção (avaria ou extravio)
  // O status do item é calculado a partir delas (exceto inativo e descartado, que são da gestão).
  // ===========================================================================================

  /** Quantas unidades estão em cada situação. */
  estoque(e: Equipamento): { disponiveis: number; emprestadas: number; emManutencao: number; total: number } {
    const emManutencao = e.quantidadeEmManutencao ?? 0;
    return {
      disponiveis: e.quantidadeDisponivel,
      emManutencao,
      emprestadas: Math.max(0, e.quantidadeTotal - e.quantidadeDisponivel - emManutencao),
      total: e.quantidadeTotal,
    };
  }

  /** Status que o item deve ter com este estoque. */
  private statusPeloEstoque(e: Equipamento): StatusEquipamento {
    if (e.status === 'inativo' || e.status === 'descartado') return e.status;
    const { disponiveis, emprestadas, emManutencao, total } = this.estoque(e);
    if (total === 0) return 'descartado';
    if (disponiveis > 0) return 'disponivel';
    // Nada disponível: se não há nenhuma emprestada, todas estão na manutenção.
    return emprestadas === 0 && emManutencao > 0 ? 'em_manutencao' : 'emprestado';
  }

  /** Aplica uma mudança de estoque e recalcula o status. */
  private mudarEstoque(id: string, fn: (e: Equipamento) => Partial<Equipamento>): void {
    const item = this.buscarPorId(id);
    if (!item) return;
    const novo = { ...item, ...fn(item) };
    this.atualizar(id, { ...fn(item), status: this.statusPeloEstoque(novo) });
  }

  /** Separa unidades para um empréstimo aprovado. Devolve false se não houver saldo. */
  reservar(id: string, quantidade: number): boolean {
    const item = this.buscarPorId(id);
    if (!item || item.status !== 'disponivel' || item.quantidadeDisponivel < quantidade) {
      return false;
    }
    this.mudarEstoque(id, (e) => ({ quantidadeDisponivel: e.quantidadeDisponivel - quantidade }));
    return true;
  }

  /**
   * Tira unidades de circulação por avaria (moderada/grave) ou extravio.
   * `origem`: 'emprestimo' = eram unidades emprestadas (devolução no balcão);
   * 'estoque' = estavam disponíveis no laboratório (registro direto na Manutenção).
   */
  enviarParaManutencao(id: string, quantidade: number, origem: 'emprestimo' | 'estoque'): void {
    this.mudarEstoque(id, (e) => ({
      quantidadeEmManutencao: (e.quantidadeEmManutencao ?? 0) + quantidade,
      quantidadeDisponivel:
        origem === 'estoque' ? Math.max(0, e.quantidadeDisponivel - quantidade) : e.quantidadeDisponivel,
    }));
  }

  /** Unidades consertadas (ou encontradas) voltam a ficar disponíveis. */
  voltarDaManutencao(id: string, quantidade: number): void {
    this.mudarEstoque(id, (e) => {
      const q = Math.min(quantidade, e.quantidadeEmManutencao ?? 0);
      return {
        quantidadeEmManutencao: (e.quantidadeEmManutencao ?? 0) - q,
        quantidadeDisponivel: e.quantidadeDisponivel + q,
      };
    });
  }

  /** Baixa: unidades sem conserto (ou perdidas) saem do acervo. Se não sobrar nenhuma, vira descartado. */
  baixar(id: string, quantidade: number): void {
    this.mudarEstoque(id, (e) => {
      const q = Math.min(quantidade, e.quantidadeEmManutencao ?? 0);
      return {
        quantidadeEmManutencao: (e.quantidadeEmManutencao ?? 0) - q,
        quantidadeTotal: e.quantidadeTotal - q,
      };
    });
  }

  /**
   * Devolve unidades ao estoque (devolução ou cancelamento de um pedido aprovado).
   * Nunca passa do total cadastrado. Item inativo ou em manutenção continua como está.
   */
  liberar(id: string, quantidade: number): void {
    const item = this.buscarPorId(id);
    if (!item) return;
    const limite = item.quantidadeTotal - (item.quantidadeEmManutencao ?? 0);
    const disponivel = Math.min(limite, item.quantidadeDisponivel + quantidade);
    // Item "em manutenção" marcado à mão pela gestão continua como está.
    if (item.status === 'em_manutencao' && !item.quantidadeEmManutencao) {
      this.atualizar(id, { quantidadeDisponivel: disponivel });
      return;
    }
    this.mudarEstoque(id, () => ({ quantidadeDisponivel: disponivel }));
  }

  /** Volta o acervo ao estado inicial da demonstração. */
  reiniciar(): void {
    this.itens.set(criarEquipamentosDemo());
  }
}
