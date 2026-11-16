/** Contratos de insumos da API v2. Datas de calendário: AAAA-MM-DD; momentos: ISO 8601. */
export type CategoriaInsumo = 'impressao_3d' | 'eletronica' | 'papelaria' | 'limpeza' | 'ferragens' | 'outros';
export type UnidadeMedida = 'un' | 'cx' | 'pct' | 'rolo' | 'kg' | 'g' | 'l' | 'ml' | 'm';
export type TipoMovimentacao = 'entrada' | 'saida';
export type MotivoEntrada = 'compra' | 'doacao' | 'ajuste_positivo';
export type MotivoSaida = 'uso_em_aula' | 'perda' | 'vencimento' | 'ajuste_negativo';
export type MotivoMovimentacao = MotivoEntrada | MotivoSaida;

export interface Insumo {
  id: string;
  nome: string;
  descricao?: string;
  categoria: CategoriaInsumo;
  unidadeMedida: UnidadeMedida;
  quantidadeAtual: number;
  estoqueMinimo: number;
  fornecedor?: string;
  validade?: string;
  localizacao?: string;
  ativo: boolean;
  estoqueBaixo: boolean;
  criadoEm: string;
  atualizadoEm?: string;
}

export interface CriarInsumoDTO {
  nome: string;
  categoria: CategoriaInsumo;
  unidadeMedida: UnidadeMedida;
  estoqueMinimo: number;
  quantidadeInicial?: number;
  descricao?: string;
  fornecedor?: string;
  validade?: string;
  localizacao?: string;
}

/** O saldo só muda por movimentação, nunca por atualização cadastral. */
export interface AtualizarInsumoDTO {
  nome?: string;
  descricao?: string;
  categoria?: CategoriaInsumo;
  unidadeMedida?: UnidadeMedida;
  estoqueMinimo?: number;
  fornecedor?: string;
  localizacao?: string;
}
export interface AlterarAtivoInsumoDTO { ativo: boolean; }
export interface FiltroInsumoDTO {
  busca?: string;
  categoria?: CategoriaInsumo;
  apenasARepor?: boolean;
  incluirInativos?: boolean;
  pagina?: number;
  itensPorPagina?: number;
}
export interface InsumoARepor extends Insumo { faltaParaOMinimo: number; }

type QuantidadeMovimentacao = {
  /** Maior que zero, até três casas decimais. */
  quantidade: number;
  observacao?: string;
  ocorridaEm?: string;
};
/** Impede combinações inválidas de tipo, motivo, destinatário e validade. */
export type CriarMovimentacaoInsumoDTO = QuantidadeMovimentacao & (
  | { tipo: 'entrada'; motivo: MotivoEntrada; validadeLote?: string; destinatarioId?: never }
  | { tipo: 'saida'; motivo: MotivoSaida; destinatarioId?: string; validadeLote?: never }
);
export interface MovimentacaoInsumo {
  id: string;
  insumo: { id: string; nome: string; unidadeMedida: UnidadeMedida };
  tipo: TipoMovimentacao;
  quantidade: number;
  saldoApos: number;
  motivo: MotivoMovimentacao;
  observacao?: string;
  responsavel: { id: string; nome: string };
  destinatario?: { id: string; nome: string };
  validadeLote?: string;
  ocorridaEm: string;
}
export interface ResultadoMovimentacaoInsumo {
  movimentacao: MovimentacaoInsumo;
  insumo: Insumo;
  alertaEstoqueBaixo: boolean;
}
export interface FiltroMovimentacaoInsumoDTO {
  dataInicio?: string;
  dataFim?: string;
  insumoId?: string;
  categoria?: CategoriaInsumo;
  tipo?: TipoMovimentacao;
  pagina?: number;
  itensPorPagina?: number;
}
export interface FiltroRelatorioConsumoDTO {
  dataInicio: string;
  dataFim: string;
  categoria?: CategoriaInsumo;
}
export interface ItemRelatorioConsumo {
  insumo: { id: string; nome: string; unidadeMedida: UnidadeMedida; categoria: CategoriaInsumo };
  totalEntradas: number;
  totalConsumido: number;
  mediaDiaria: number;
  quantidadeAtual: number;
  diasRestantes: number | null;
  previsaoDeTermino: string | null;
  estoqueBaixo: boolean;
}
export interface RelatorioConsumo {
  dataInicio: string;
  dataFim: string;
  dias: number;
  itens: ItemRelatorioConsumo[];
}
