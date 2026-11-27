/**
 * Contrato de MANUTENÇÃO: avarias e extravios (faltas) de equipamentos.
 * Rotas (backend): GET/POST /manutencoes e PATCH /manutencoes/:id (somente admin).
 * Na demonstração tudo fica no navegador (ManutencaoService).
 *
 * Uma OCORRÊNCIA é aberta:
 *  - na devolução, no balcão (unidade voltou com avaria ou não voltou), ou
 *  - direto na tela de Manutenção (item encontrado com problema no laboratório).
 *
 * Regra de bloqueio (estoque):
 *  - avaria LEVE: só fica registrada; a unidade volta ao estoque.
 *  - avaria MODERADA ou GRAVE e EXTRAVIO: a unidade sai do estoque e não pode ser emprestada
 *    até a coordenação marcar como consertada/encontrada (volta) ou dar baixa (sai do acervo).
 */
import { UsuarioResumo } from './usuario.model';

/** `avaria`: voltou com problema. `extravio`: não voltou (falta). */
export type TipoOcorrencia = 'avaria' | 'extravio';

export type TipoAvaria = 'tela_carcaca' | 'nao_liga' | 'peca_faltando' | 'desgaste' | 'outro';

export type GravidadeAvaria = 'leve' | 'moderada' | 'grave';

/**
 * - `registrada`: avaria leve, só para histórico (a unidade continua no estoque).
 * - `aberta`: unidade fora do estoque aguardando providência.
 * - `em_assistencia`: enviada para conserto.
 * - `concluida`: consertada ou encontrada; a unidade voltou ao estoque.
 * - `baixa`: sem conserto ou perdida; a unidade saiu do acervo.
 */
export type StatusManutencao = 'registrada' | 'aberta' | 'em_assistencia' | 'concluida' | 'baixa';

/**
 * Por que a unidade saiu do acervo. Avaria: irreparável, conserto inviável ou obsolescência.
 * Extravio: perda definitiva ou furto/roubo (este exige o número do boletim de ocorrência).
 */
export type MotivoBaixa = 'irreparavel' | 'conserto_inviavel' | 'obsolescencia' | 'extravio_definitivo' | 'furto_roubo';

/**
 * Registro de auditoria da BAIXA PATRIMONIAL. Gerado uma única vez e nunca alterado:
 * vira o "Termo de baixa" que a coordenação imprime e arquiva.
 */
export interface RegistroBaixa {
  /** Código do termo, ex.: "TB-2026-0001". */
  protocolo: string;
  motivo: MotivoBaixa;
  /** Parecer técnico ou relato do que aconteceu (mínimo 20 caracteres). */
  parecer: string;
  /** Número do laudo da assistência técnica, quando houver. */
  laudo?: string;
  /** Número do processo administrativo ou do boletim de ocorrência. */
  processo?: string;
  /**
   * Valor do bem baixado, em reais (prestação de contas). Calculado pelo sistema:
   * valor unitário do cadastro × unidades baixadas. Ninguém digita, ninguém altera.
   */
  valorEstimado?: number;
  /** Quem estava com o item foi informado da baixa (obrigatório quando havia responsável). */
  responsavelCiente: boolean;
  /** Pessoa que conferiu o bem junto com a coordenação. */
  testemunha?: string;
  autorizadoPor: UsuarioResumo;
  /** ISO 8601 completo. */
  em: string;
}

/** Um passo da história da ocorrência (só acréscimo). */
export interface PassoManutencao {
  em: string;
  por: UsuarioResumo;
  texto: string;
}

export interface Manutencao {
  id: string;
  /** Código amigável, ex.: "OC-2026-0003". */
  protocolo: string;
  tipo: TipoOcorrencia;
  equipamentoId: string;
  /** Nome e patrimônio do equipamento no momento do registro (para exibir). */
  equipamento: string;
  codigoPatrimonio: string;
  /** Quantas unidades esta ocorrência envolve. */
  quantidade: number;
  /**
   * Quais unidades (etiqueta, nº de série...). Preenchido quando só parte das unidades
   * de uma ocorrência foi consertada, encontrada ou baixada.
   */
  identificacao?: string;
  /**
   * Resolução parcial: as unidades resolvidas viram uma ocorrência própria (com protocolo novo)
   * que aponta para a de origem; a de origem continua aberta com as restantes.
   */
  origemProtocolo?: string;
  /** Só para avaria. */
  tipoAvaria?: TipoAvaria;
  gravidade?: GravidadeAvaria;
  /** O que aconteceu (obrigatório para avaria). */
  descricao: string;
  /** Tem foto? A imagem fica separada (ManutencaoService.foto(id)) para não pesar a lista. */
  temFoto?: boolean;
  /** Pedido em que a ocorrência foi registrada (quando veio de uma devolução). */
  emprestimoId?: string;
  protocoloEmprestimo?: string;
  /** Quem estava com o item quando o problema foi registrado (responsável do pedido). */
  responsavel?: UsuarioResumo;
  /** Quem registrou (coordenação). */
  registradoPor: UsuarioResumo;
  /** true quando a unidade saiu do estoque por causa desta ocorrência. */
  bloqueia: boolean;
  /** Nome da assistência técnica, quando houver (guardado para o histórico). */
  assistencia?: string;
  /** Assistência credenciada que recebeu o equipamento (AssistenciaService). */
  assistenciaId?: string;
  status: StatusManutencao;
  /** ISO 8601 completo. */
  dataRegistro: string;
  dataConclusao?: string;
  historico: PassoManutencao[];
  /** Termo de baixa (só quando status = 'baixa'). */
  baixa?: RegistroBaixa;
}

/** O que o balcão (ou a tela de Manutenção) informa sobre UM item com problema. */
export interface RegistroAvariaDTO {
  equipamentoId: string;
  /** Unidades que não voltaram. */
  faltando: number;
  /** Unidades que voltaram com avaria. */
  avariadas: number;
  tipoAvaria?: TipoAvaria;
  gravidade?: GravidadeAvaria;
  descricao?: string;
  /** Foto já reduzida, em data URL (JPEG). */
  foto?: string;
}

/** Corpo do PATCH /manutencoes/:id. */
export interface AtualizarManutencaoDTO {
  status?: StatusManutencao;
  descricao?: string;
  assistencia?: string;
}
