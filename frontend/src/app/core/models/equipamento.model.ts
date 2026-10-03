/**
 * @file equipamento.model.ts
 * @description Modelos de dados para controle de patrimônio, inventário de insumos
 * e disponibilidade de equipamentos do laboratório.
 */

/**
 * Condição operacional e logística do equipamento no laboratório.
 *
 * - `disponivel`: Pronto para agendamento e retirada imediata.
 * - `emprestado`: Atualmente em posse de um solicitante com devolução pendente.
 * - `em_manutencao`: Indisponível temporariamente por reparo técnico ou calibração.
 * - `inativo`: Retirado de catálogo temporariamente pela gestão do espaço.
 * - `descartado`: Baixa patrimonial definitiva (avaria irreparável, extravio ou descarte).
 */
export type StatusEquipamento =
  'disponivel' | 'emprestado' | 'em_manutencao' | 'inativo' | 'descartado';

/**
 * Categorias para taxonomia e filtros no catálogo do laboratório.
 *
 * - `ferramenta`: Ferramental manual ou elétrico portátil (ex.: chaves, parafusadeiras).
 * - `eletronico`: Componentes de bancada e placas (ex.: osciloscópios, fontes, microcontroladores).
 * - `impressora_3d`: Unidades de prototipagem aditiva (FDM, SLA).
 * - `corte_laser`: Maquinário de corte e gravação CNC a laser.
 * - `consumivel`: Materiais com desgaste por uso (ex.: filamentos, brocas, solda).
 * - `outros`: Demais utilitários que não se enquadram nas categorias principais.
 */
export type CategoriaEquipamento =
  'ferramenta' | 'eletronico' | 'impressora_3d' | 'corte_laser' | 'consumivel' | 'outros';

/**
 * Representação completa do Equipamento ou Material no inventário.
 */
export interface Equipamento {
  /** Identificador primário do item (UUID) */
  id: string;

  /** Nome do equipamento (ex.: "Multímetro Digital Minipa ET-1002") */
  nome: string;

  /** Detalhes de especificações técnicas, voltagem e restrições de operação */
  descricao: string;

  /** Código da plaqueta de tombamento institucional ou etiqueta patrimonial */
  codigoPatrimonio: string;

  /** Agrupamento lógico para busca e relatórios */
  categoria: CategoriaEquipamento;

  /** Estado operacional corrente do patrimônio */
  status: StatusEquipamento;

  /** Posição física exata dentro do laboratório (ex.: "Bancada 03 - Gaveteiro B") */
  localizacao: string;

  /** URL pública da foto do equipamento para exibição em cards e catálogo */
  fotoUrl?: string;

  /**
   * Bloqueador de segurança: quando verdadeiro, o usuário deve ter certificação
   * prévia de oficina para submeter a solicitação deste equipamento.
   */
  requerTreinamento: boolean;

  /** Quantidade física pronta para ser cedida no presente momento */
  quantidadeDisponivel: number;

  /** Quantidade total cadastrada no acervo */
  quantidadeTotal: number;

  /** Registro cronológico de inserção no sistema */
  criadoEm: string;

  /** Última atualização cadastral ou técnica */
  atualizadoEm?: string;
}

/**
 * Contrato de envio de dados para o cadastro de novos bens ou materiais.
 */
export interface CriarEquipamentoDTO {
  nome: string;
  descricao: string;
  codigoPatrimonio: string;
  categoria: CategoriaEquipamento;
  localizacao: string;
  fotoUrl?: string;
  requerTreinamento: boolean;
  quantidadeTotal: number;
}

/**
 * Contrato para atualização parcial de dados de equipamentos existentes.
 */
export interface AtualizarEquipamentoDTO {
  nome?: string;
  descricao?: string;
  categoria?: CategoriaEquipamento;
  status?: StatusEquipamento;
  localizacao?: string;
  fotoUrl?: string;
  requerTreinamento?: boolean;
  quantidadeTotal?: number;
}

/**
 * Estrutura de parâmetros de query string aceitos nos endpoints de busca e paginação.
 */
export interface FiltroEquipamentoDTO {
  /** Termo de pesquisa textual aplicado a nome ou código de patrimônio */
  busca?: string;

  /** Filtro estrito por categoria */
  categoria?: CategoriaEquipamento;

  /** Filtro pelo status operacional */
  status?: StatusEquipamento;

  /** Se ativado, retorna apenas itens que possuem saldo em `quantidadeDisponivel > 0` */
  apenasDisponiveis?: boolean;
}
