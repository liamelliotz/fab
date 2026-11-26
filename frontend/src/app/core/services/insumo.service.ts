import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { buscarLocal, localPorTexto } from '../constants/escola-modelo.constants';
import {
  CategoriaInsumo,
  CriarInsumoDTO,
  Insumo,
  MotivoEntrada,
  MotivoMovimentacao,
  MotivoSaida,
  MovimentacaoInsumo,
  TipoMovimentacao,
  UnidadeMedida,
} from '../models/insumo.model';
import { Resultado, falha, sucesso } from '../models/resultado.model';
import { UsuarioResumo } from '../models/usuario.model';
import { gravarJson, lerJson, ouvirOutrasAbas } from '../utils/armazenamento.utils';
import { agoraISO, diferencaEmDias, hojeISO, horasDepoisISO, somarDias } from '../utils/date.utils';
import { AuthService } from './auth.service';
import { UsuarioService, resumoDemo } from './usuario.service';

const CHAVE_INSUMOS = 'fab_demo_v7_insumos';
const CHAVE_MOVIMENTACOES = 'fab_demo_v7_movimentacoes_insumos';

export const NOME_CATEGORIA_INSUMO: Record<CategoriaInsumo, string> = {
  impressao_3d: 'Impressão 3D',
  eletronica: 'Eletrônica',
  papelaria: 'Papelaria',
  limpeza: 'Limpeza',
  ferragens: 'Ferragens',
  outros: 'Outros',
};

export const NOME_UNIDADE: Record<UnidadeMedida, string> = {
  un: 'unidade(s)',
  cx: 'caixa(s)',
  pct: 'pacote(s)',
  rolo: 'rolo(s)',
  kg: 'kg',
  g: 'g',
  l: 'litro(s)',
  ml: 'ml',
  m: 'metro(s)',
};

export const NOME_MOTIVO_INSUMO: Record<MotivoMovimentacao, string> = {
  compra: 'Compra',
  doacao: 'Doação',
  ajuste_positivo: 'Ajuste de inventário (+)',
  uso_em_aula: 'Uso em aula ou projeto',
  perda: 'Perda ou dano',
  vencimento: 'Vencimento',
  ajuste_negativo: 'Ajuste de inventário (−)',
};

export const MOTIVOS_ENTRADA: MotivoEntrada[] = ['compra', 'doacao', 'ajuste_positivo'];
export const MOTIVOS_SAIDA: MotivoSaida[] = ['uso_em_aula', 'perda', 'vencimento', 'ajuste_negativo'];

/**
 * Movimentação da demonstração: o contrato da API mais o LOCAL onde o insumo foi usado
 * (alimenta o mapa da escola) e o documento da entrada (nota fiscal, termo de doação).
 */
export interface MovimentacaoDemo extends MovimentacaoInsumo {
  localId?: string;
  documento?: string;
}

/** O que a tela envia para registrar uma entrada ou saída. */
export interface NovaMovimentacao {
  tipo: TipoMovimentacao;
  motivo: MotivoMovimentacao;
  quantidade: number;
  /** Finalidade (saída) ou observação (entrada). Obrigatória para uso em aula, perda e ajustes. */
  observacao?: string;
  /** Professor que recebeu o insumo (obrigatório no uso em aula). */
  destinatarioId?: string;
  /** Onde o insumo foi usado (obrigatório no uso em aula). */
  localId?: string;
  /** Nota fiscal ou termo de doação (entradas). */
  documento?: string;
  validadeLote?: string;
}

/** Consumo de um insumo em um período (para a previsão de término e o relatório). */
export interface ConsumoInsumo {
  insumo: Insumo;
  totalEntradas: number;
  totalConsumido: number;
  /** Consumo médio por dia no período (saídas por uso em aula). */
  mediaDiaria: number;
  /** null = sem consumo no período (não dá para prever). */
  diasRestantes: number | null;
  previsaoDeTermino: string | null;
}

// -------------------------------------------------------------------------------------------------
// Dados de exemplo: o saldo de cada insumo é CALCULADO a partir das movimentações, então o
// histórico sempre fecha com o estoque (auditoria).
// -------------------------------------------------------------------------------------------------
type Saida = [diasAtras: number, quantidade: number, professor: string, localId: string, finalidade: string];
interface ModeloInsumo {
  id: string;
  nome: string;
  descricao: string;
  categoria: CategoriaInsumo;
  unidadeMedida: UnidadeMedida;
  estoqueMinimo: number;
  fornecedor: string;
  localizacao: string;
  validade?: string;
  compra: [diasAtras: number, quantidade: number, documento: string];
  saidas: Saida[];
  extras?: { diasAtras: number; tipo: TipoMovimentacao; motivo: MotivoMovimentacao; quantidade: number; observacao: string; documento?: string }[];
}

const MODELOS: ModeloInsumo[] = [
  {
    id: 'ins-pla', nome: 'Filamento PLA 1,75 mm', descricao: 'Rolo de 1 kg, cor branca.', categoria: 'impressao_3d',
    unidadeMedida: 'rolo', estoqueMinimo: 4, fornecedor: 'Maker Norte', localizacao: 'Lab. Maker · Armário 3',
    compra: [60, 8, 'NF 10.482'],
    saidas: [
      [50, 1, 'usr-professor', 'lab-maker', 'Peças do projeto integrador'],
      [41, 1, 'usr-carlos', 'lab-maker', 'Caixas para os circuitos do 3º módulo'],
      [33, 1, 'usr-professor', 'lab-maker', 'Protótipos da feira de ciências'],
      [24, 1, 'usr-ana', 'lab-maker', 'Oficina de modelagem 3D'],
      [12, 1, 'usr-professor', 'lab-maker', 'Peças do projeto integrador'],
      [5, 1, 'usr-carlos', 'lab-maker', 'Suportes para sensores'],
    ],
  },
  {
    id: 'ins-resina', nome: 'Resina UV padrão', descricao: 'Frasco de 1 litro para impressora SLA.', categoria: 'impressao_3d',
    unidadeMedida: 'l', estoqueMinimo: 1, fornecedor: 'Maker Norte', localizacao: 'Lab. Maker · Armário 3',
    validade: somarDias(hojeISO(), 120),
    compra: [55, 3, 'NF 10.511'],
    saidas: [
      [40, 0.5, 'usr-professor', 'lab-maker', 'Miniaturas do projeto de arquitetura'],
      [20, 0.5, 'usr-ana', 'lab-maker', 'Oficina de modelagem 3D'],
      [8, 0.5, 'usr-professor', 'lab-maker', 'Peças de encaixe'],
    ],
  },
  {
    id: 'ins-solda', nome: 'Fio de solda 0,8 mm', descricao: 'Estanho 60/40, carretel de 250 g.', categoria: 'eletronica',
    unidadeMedida: 'rolo', estoqueMinimo: 2, fornecedor: 'EletroPeças AP', localizacao: 'Lab. de Eletrônica · Gaveteiro A',
    compra: [58, 6, 'NF 3.207'],
    saidas: [
      [30, 1, 'usr-carlos', 'lab-eletronica', 'Montagem de fontes reguladas'],
      [10, 1, 'usr-carlos', 'lab-eletronica', 'Projeto de eletrônica analógica'],
    ],
  },
  {
    id: 'ins-resistores', nome: 'Resistores sortidos', descricao: 'Pacote com 600 peças (30 valores).', categoria: 'eletronica',
    unidadeMedida: 'pct', estoqueMinimo: 5, fornecedor: 'EletroPeças AP', localizacao: 'Lab. de Eletrônica · Gaveteiro B',
    compra: [59, 15, 'NF 3.207'],
    saidas: [
      [45, 1, 'usr-carlos', 'lab-eletronica', 'Aula de lei de Ohm'],
      [31, 1, 'usr-joao', 'lab-eletronica', 'Circuitos do 2º módulo'],
      [17, 1, 'usr-carlos', 'lab-eletronica', 'Projeto de eletrônica analógica'],
    ],
  },
  {
    id: 'ins-jumpers', nome: 'Jumpers macho-macho', descricao: 'Pacote com 65 cabos para protoboard.', categoria: 'eletronica',
    unidadeMedida: 'pct', estoqueMinimo: 4, fornecedor: 'EletroPeças AP', localizacao: 'Lab. de Eletrônica · Gaveteiro B',
    compra: [57, 6, 'NF 3.198'],
    saidas: [
      [44, 1, 'usr-joao', 'lab-informatica', 'Robótica com Arduino'],
      [28, 1, 'usr-carlos', 'lab-eletronica', 'Montagem em protoboard'],
      [15, 1, 'usr-joao', 'lab-informatica', 'Robótica com Arduino'],
      [6, 1, 'usr-ana', 'lab-maker', 'Oficina de automação'],
    ],
  },
  {
    id: 'ins-papel', nome: 'Papel A4 75 g', descricao: 'Resma com 500 folhas.', categoria: 'papelaria',
    unidadeMedida: 'pct', estoqueMinimo: 10, fornecedor: 'Papelaria Central', localizacao: 'Almoxarifado de TI · Prateleira 4',
    compra: [60, 30, 'NF 88.130'],
    saidas: [
      [50, 3, 'usr-maria', 'sala-101', 'Provas bimestrais do 1º ano'],
      [35, 4, 'usr-joao', 'sala-102', 'Listas de exercícios'],
      [20, 3, 'usr-maria', 'sala-101', 'Atividades de recuperação'],
      [7, 2, 'usr-ana', 'lab-informatica', 'Apostila da oficina web'],
    ],
    extras: [{ diasAtras: 25, tipo: 'entrada', motivo: 'doacao', quantidade: 5, observacao: 'Doação da associação de pais.', documento: 'Termo de doação 07/2026' }],
  },
  {
    id: 'ins-toner', nome: 'Toner para impressora laser', descricao: 'Cartucho compatível com a impressora da coordenação.', categoria: 'papelaria',
    unidadeMedida: 'un', estoqueMinimo: 2, fornecedor: 'Papelaria Central', localizacao: 'Coordenação · Armário',
    compra: [52, 3, 'NF 88.004'],
    saidas: [
      [38, 1, 'usr-maria', 'coordenacao', 'Impressora da coordenação'],
      [14, 1, 'usr-joao', 'coordenacao', 'Impressora da coordenação'],
    ],
  },
  {
    id: 'ins-alcool', nome: 'Álcool isopropílico', descricao: 'Limpeza de placas e lentes. Frasco de 1 litro.', categoria: 'limpeza',
    unidadeMedida: 'l', estoqueMinimo: 1, fornecedor: 'EletroPeças AP', localizacao: 'Lab. de Eletrônica · Armário',
    validade: somarDias(hojeISO(), 300),
    compra: [50, 4, 'NF 3.150'],
    saidas: [
      [35, 0.5, 'usr-carlos', 'lab-eletronica', 'Limpeza das placas após soldagem'],
      [21, 0.5, 'usr-professor', 'lab-maker', 'Limpeza da mesa da impressora 3D'],
      [9, 0.5, 'usr-carlos', 'lab-eletronica', 'Limpeza das placas após soldagem'],
    ],
  },
  {
    id: 'ins-parafusos', nome: 'Parafusos M3 com porca', descricao: 'Pacote com 100 conjuntos.', categoria: 'ferragens',
    unidadeMedida: 'pct', estoqueMinimo: 3, fornecedor: 'Ferragens Macapá', localizacao: 'Lab. Maker · Gaveteiro',
    compra: [56, 8, 'NF 1.874'],
    saidas: [
      [40, 1, 'usr-professor', 'lab-maker', 'Montagem dos robôs'],
      [18, 1, 'usr-ana', 'lab-maker', 'Oficina de automação'],
    ],
  },
  {
    id: 'ins-pilhas', nome: 'Pilhas AA', descricao: 'Alcalinas, para controles e microfones.', categoria: 'outros',
    unidadeMedida: 'un', estoqueMinimo: 12, fornecedor: 'Papelaria Central', localizacao: 'Almoxarifado de TI · Prateleira 2',
    compra: [59, 48, 'NF 88.122'],
    saidas: [
      [42, 8, 'usr-ana', 'auditorio', 'Microfones da palestra de abertura'],
      [26, 10, 'usr-maria', 'quadra', 'Som do evento de integração'],
      [11, 6, 'usr-professor', 'sala-103', 'Controles dos projetores'],
    ],
    extras: [{ diasAtras: 3, tipo: 'saida', motivo: 'perda', quantidade: 2, observacao: 'Duas pilhas vazaram dentro da caixa.' }],
  },
];

export function criarInsumosDemo(): { insumos: Insumo[]; movimentacoes: MovimentacaoDemo[] } {
  const admin = resumoDemo('usr-admin');
  const insumos: Insumo[] = [];
  const movimentacoes: MovimentacaoDemo[] = [];

  for (const m of MODELOS) {
    const eventos: { diasAtras: number; tipo: TipoMovimentacao; motivo: MotivoMovimentacao; quantidade: number; observacao?: string; destinatario?: UsuarioResumo; localId?: string; documento?: string }[] = [
      { diasAtras: m.compra[0], tipo: 'entrada' as const, motivo: 'compra' as const, quantidade: m.compra[1], observacao: `Compra de ${m.fornecedor}.`, documento: m.compra[2] },
      ...m.saidas.map(([diasAtras, quantidade, prof, localId, finalidade]) => ({
        diasAtras, tipo: 'saida' as const, motivo: 'uso_em_aula' as const, quantidade, observacao: finalidade,
        destinatario: resumoDemo(prof), localId,
      })),
      ...(m.extras ?? []),
    ].sort((a, b) => b.diasAtras - a.diasAtras);

    let saldo = 0;
    for (const e of eventos) {
      saldo = arredondar(saldo + (e.tipo === 'entrada' ? e.quantidade : -e.quantidade));
      movimentacoes.push({
        id: `${m.id}-${e.diasAtras}-${e.tipo}`,
        insumo: { id: m.id, nome: m.nome, unidadeMedida: m.unidadeMedida },
        tipo: e.tipo,
        quantidade: e.quantidade,
        saldoApos: saldo,
        motivo: e.motivo,
        observacao: e.observacao,
        responsavel: admin,
        destinatario: e.destinatario && { id: e.destinatario.id, nome: e.destinatario.nome },
        localId: e.localId,
        documento: e.documento,
        ocorridaEm: horasDepoisISO(-e.diasAtras * 24 + 3),
      });
    }

    insumos.push({
      id: m.id,
      nome: m.nome,
      descricao: m.descricao,
      categoria: m.categoria,
      unidadeMedida: m.unidadeMedida,
      quantidadeAtual: saldo,
      estoqueMinimo: m.estoqueMinimo,
      fornecedor: m.fornecedor,
      validade: m.validade,
      localizacao: m.localizacao,
      ativo: true,
      estoqueBaixo: saldo <= m.estoqueMinimo,
      criadoEm: somarDias(hojeISO(), -m.compra[0]),
    });
  }
  movimentacoes.sort((a, b) => b.ocorridaEm.localeCompare(a.ocorridaEm));
  return { insumos, movimentacoes };
}

/** Evita 2.9999999 em quantidades decimais (litros, kg). Três casas, como no contrato. */
function arredondar(valor: number): number {
  return Math.round(valor * 1000) / 1000;
}

/**
 * Gestão de INSUMOS no modo demonstração (itens de consumo que acabam e são repostos).
 *
 * Regras (as mesmas do contrato da API, card D2):
 *  - o saldo só muda por movimentação (entrada ou saída), nunca editando o cadastro;
 *  - o saldo nunca fica negativo;
 *  - toda movimentação guarda quem registrou, quando, o motivo e o saldo depois dela (auditoria);
 *  - uso em aula exige o professor que recebeu, o local e a finalidade;
 *  - saldo igual ou abaixo do mínimo = "a repor".
 */
@Injectable({ providedIn: 'root' })
export class InsumoService {
  private readonly auth = inject(AuthService);
  private readonly usuarios = inject(UsuarioService);

  readonly modoDemo = this.auth.modoDemo;

  private readonly inicial = criarInsumosDemo();
  readonly insumos = signal<Insumo[]>(lerJson<Insumo[]>(CHAVE_INSUMOS) ?? this.inicial.insumos);
  /** Movimentações, da mais nova para a mais antiga. */
  readonly movimentacoes = signal<MovimentacaoDemo[]>(
    lerJson<MovimentacaoDemo[]>(CHAVE_MOVIMENTACOES) ?? this.inicial.movimentacoes,
  );

  readonly ativos = computed(() => this.insumos().filter((i) => i.ativo));
  readonly aRepor = computed(() => this.ativos().filter((i) => i.quantidadeAtual <= i.estoqueMinimo));

  constructor() {
    effect(() => gravarJson(CHAVE_INSUMOS, this.insumos()));
    effect(() => gravarJson(CHAVE_MOVIMENTACOES, this.movimentacoes()));
    ouvirOutrasAbas<Insumo[]>(CHAVE_INSUMOS, (v) => v && this.insumos.set(v));
    ouvirOutrasAbas<MovimentacaoDemo[]>(CHAVE_MOVIMENTACOES, (v) => v && this.movimentacoes.set(v));
  }

  // ---------- Consultas ----------

  buscarPorId(id: string): Insumo | undefined {
    return this.insumos().find((i) => i.id === id);
  }

  doInsumo(id: string): MovimentacaoDemo[] {
    return this.movimentacoes().filter((m) => m.insumo.id === id);
  }

  /** Id do local da escola onde o insumo fica guardado. */
  localDeGuarda(i: Insumo): string {
    return localPorTexto(i.localizacao).id;
  }

  /**
   * Consumo (saídas por uso em aula) nos últimos `dias` dias e a previsão de quando acaba.
   * Perdas e vencimentos não entram na média: não são consumo planejado.
   */
  consumo(i: Insumo, dias = 30, ate = hojeISO()): ConsumoInsumo {
    const inicio = somarDias(ate, -dias);
    const doPeriodo = this.doInsumo(i.id).filter((m) => {
      const dia = m.ocorridaEm.slice(0, 10);
      return dia > inicio && dia <= ate;
    });
    const totalEntradas = arredondar(doPeriodo.filter((m) => m.tipo === 'entrada').reduce((s, m) => s + m.quantidade, 0));
    const totalConsumido = arredondar(
      doPeriodo.filter((m) => m.motivo === 'uso_em_aula').reduce((s, m) => s + m.quantidade, 0),
    );
    const mediaDiaria = totalConsumido / dias;
    if (mediaDiaria <= 0) {
      return { insumo: i, totalEntradas, totalConsumido, mediaDiaria: 0, diasRestantes: null, previsaoDeTermino: null };
    }
    const diasRestantes = Math.floor(i.quantidadeAtual / mediaDiaria);
    return {
      insumo: i,
      totalEntradas,
      totalConsumido,
      mediaDiaria,
      diasRestantes,
      previsaoDeTermino: somarDias(hojeISO(), diasRestantes),
    };
  }

  /** Relatório de consumo de todos os insumos ativos, os que acabam primeiro no topo. */
  relatorio(dias = 30): ConsumoInsumo[] {
    return this.ativos()
      .map((i) => this.consumo(i, dias))
      .sort((a, b) => (a.diasRestantes ?? Infinity) - (b.diasRestantes ?? Infinity) || a.insumo.nome.localeCompare(b.insumo.nome));
  }

  // ---------- Cadastro ----------

  validarCadastro(dto: CriarInsumoDTO, ignorarId?: string): string | null {
    const nome = dto.nome.trim();
    if (nome.length < 3) return 'Informe o nome do insumo (mínimo 3 caracteres).';
    const repetido = this.insumos().some((i) => i.id !== ignorarId && i.nome.trim().toLowerCase() === nome.toLowerCase());
    if (repetido) return 'Já existe um insumo com este nome.';
    if (!Number.isFinite(dto.estoqueMinimo) || dto.estoqueMinimo < 0) return 'O estoque mínimo não pode ser negativo.';
    if (dto.quantidadeInicial !== undefined && (!Number.isFinite(dto.quantidadeInicial) || dto.quantidadeInicial < 0)) {
      return 'A quantidade inicial não pode ser negativa.';
    }
    if (!dto.localizacao?.trim()) return 'Informe onde o insumo fica guardado.';
    return null;
  }

  cadastrar(dto: CriarInsumoDTO): Resultado<Insumo> {
    const erro = this.validarCadastro(dto);
    if (erro) return falha(erro);
    const novo: Insumo = {
      id: crypto.randomUUID(),
      nome: dto.nome.trim(),
      descricao: dto.descricao?.trim() || undefined,
      categoria: dto.categoria,
      unidadeMedida: dto.unidadeMedida,
      quantidadeAtual: 0,
      estoqueMinimo: dto.estoqueMinimo,
      fornecedor: dto.fornecedor?.trim() || undefined,
      validade: dto.validade || undefined,
      localizacao: dto.localizacao?.trim(),
      ativo: true,
      estoqueBaixo: dto.estoqueMinimo >= 0,
      criadoEm: hojeISO(),
    };
    this.insumos.update((lista) => [...lista, novo]);
    // O saldo inicial também é uma movimentação: o histórico sempre fecha com o estoque.
    if (dto.quantidadeInicial && dto.quantidadeInicial > 0) {
      this.movimentar(novo.id, {
        tipo: 'entrada',
        motivo: 'ajuste_positivo',
        quantidade: dto.quantidadeInicial,
        observacao: 'Saldo inicial no cadastro.',
      });
    } else {
      this.recalcularAlerta(novo.id);
    }
    return sucesso(this.buscarPorId(novo.id)!);
  }

  atualizar(id: string, dto: CriarInsumoDTO): string | null {
    const atual = this.buscarPorId(id);
    if (!atual) return 'Insumo não encontrado.';
    const erro = this.validarCadastro(dto, id);
    if (erro) return erro;
    this.insumos.update((lista) =>
      lista.map((i) =>
        i.id !== id
          ? i
          : {
              ...i,
              nome: dto.nome.trim(),
              descricao: dto.descricao?.trim() || undefined,
              categoria: dto.categoria,
              unidadeMedida: dto.unidadeMedida,
              estoqueMinimo: dto.estoqueMinimo,
              fornecedor: dto.fornecedor?.trim() || undefined,
              validade: dto.validade || undefined,
              localizacao: dto.localizacao?.trim(),
              estoqueBaixo: i.quantidadeAtual <= dto.estoqueMinimo,
              atualizadoEm: agoraISO(),
            },
      ),
    );
    return null;
  }

  alternarAtivo(id: string): void {
    this.insumos.update((lista) =>
      lista.map((i) => (i.id === id ? { ...i, ativo: !i.ativo, atualizadoEm: agoraISO() } : i)),
    );
  }

  // ---------- Movimentação ----------

  validarMovimentacao(i: Insumo, dados: NovaMovimentacao): string | null {
    if (!i.ativo) return 'Reative o insumo antes de movimentar.';
    const q = dados.quantidade;
    if (!Number.isFinite(q) || q <= 0) return 'A quantidade deve ser maior que zero.';
    if (Math.round(q * 1000) !== q * 1000) return 'Use no máximo três casas decimais.';
    const motivosValidos: MotivoMovimentacao[] = dados.tipo === 'entrada' ? MOTIVOS_ENTRADA : MOTIVOS_SAIDA;
    if (!motivosValidos.includes(dados.motivo)) return 'Escolha o motivo da movimentação.';
    const obs = dados.observacao?.trim() ?? '';
    if (dados.tipo === 'saida') {
      if (q > i.quantidadeAtual) {
        return `Saldo insuficiente: há ${formatarQuantidade(i.quantidadeAtual)} ${NOME_UNIDADE[i.unidadeMedida]} de "${i.nome}".`;
      }
      if (dados.motivo === 'uso_em_aula') {
        const prof = dados.destinatarioId ? this.usuarios.buscarPorId(dados.destinatarioId) : undefined;
        if (!prof || prof.status !== 'ativo') return 'Escolha o professor que recebeu o insumo.';
        if (!buscarLocal(dados.localId)) return 'Escolha onde o insumo será usado.';
        if (obs.length < 5) return 'Informe a finalidade (turma, aula ou projeto).';
      } else if (obs.length < 5) {
        return 'Explique o motivo da saída (mínimo 5 caracteres).';
      }
    } else if (dados.motivo !== 'compra' && obs.length < 5) {
      return 'Explique a origem da entrada (mínimo 5 caracteres).';
    }
    if (dados.validadeLote && dados.validadeLote < hojeISO()) return 'A validade do lote já passou.';
    return null;
  }

  /** Registra a entrada ou saída e devolve o insumo atualizado (com o alerta de estoque baixo). */
  movimentar(id: string, dados: NovaMovimentacao): Resultado<{ insumo: Insumo; movimentacao: MovimentacaoDemo; alertaEstoqueBaixo: boolean }> {
    const i = this.buscarPorId(id);
    if (!i) return falha('Insumo não encontrado.');
    const erro = this.validarMovimentacao(i, dados);
    if (erro) return falha(erro);

    const saldo = arredondar(i.quantidadeAtual + (dados.tipo === 'entrada' ? dados.quantidade : -dados.quantidade));
    const eu = this.auth.usuarioAtual();
    const destinatario = dados.tipo === 'saida' && dados.destinatarioId ? this.usuarios.resumo(dados.destinatarioId) : undefined;
    const mov: MovimentacaoDemo = {
      id: crypto.randomUUID(),
      insumo: { id: i.id, nome: i.nome, unidadeMedida: i.unidadeMedida },
      tipo: dados.tipo,
      quantidade: dados.quantidade,
      saldoApos: saldo,
      motivo: dados.motivo,
      observacao: dados.observacao?.trim() || undefined,
      responsavel: { id: eu.id, nome: eu.nome },
      destinatario: destinatario && { id: destinatario.id, nome: destinatario.nome },
      localId: dados.tipo === 'saida' && dados.motivo === 'uso_em_aula' ? dados.localId : undefined,
      documento: dados.tipo === 'entrada' ? dados.documento?.trim() || undefined : undefined,
      validadeLote: dados.tipo === 'entrada' ? dados.validadeLote || undefined : undefined,
      ocorridaEm: agoraISO(),
    };
    const estavaBaixo = i.quantidadeAtual <= i.estoqueMinimo;
    this.insumos.update((lista) =>
      lista.map((x) =>
        x.id !== id
          ? x
          : {
              ...x,
              quantidadeAtual: saldo,
              estoqueBaixo: saldo <= x.estoqueMinimo,
              // Entrada com validade mais próxima passa a ser a validade do estoque.
              validade:
                mov.validadeLote && (!x.validade || mov.validadeLote < x.validade) ? mov.validadeLote : x.validade,
              atualizadoEm: mov.ocorridaEm,
            },
      ),
    );
    this.movimentacoes.update((lista) => [mov, ...lista]);
    const insumo = this.buscarPorId(id)!;
    return sucesso({ insumo, movimentacao: mov, alertaEstoqueBaixo: !estavaBaixo && insumo.estoqueBaixo });
  }

  /** Dias até a validade (negativo = vencido). null = sem validade. */
  diasParaVencer(i: Insumo): number | null {
    return i.validade ? diferencaEmDias(hojeISO(), i.validade) : null;
  }

  reiniciar(): void {
    const dados = criarInsumosDemo();
    this.insumos.set(dados.insumos);
    this.movimentacoes.set(dados.movimentacoes);
  }

  private recalcularAlerta(id: string): void {
    this.insumos.update((lista) =>
      lista.map((i) => (i.id === id ? { ...i, estoqueBaixo: i.quantidadeAtual <= i.estoqueMinimo } : i)),
    );
  }
}

/** "1,5" · "12" · "0,25" (sem zeros sobrando). */
export function formatarQuantidade(valor: number): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}
