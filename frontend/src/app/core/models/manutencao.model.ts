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
  /** Nome da assistência técnica, quando houver. */
  assistencia?: string;
  status: StatusManutencao;
  /** ISO 8601 completo. */
  dataRegistro: string;
  dataConclusao?: string;
  historico: PassoManutencao[];
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
