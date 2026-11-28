import { TipoEventoEmprestimo } from '../models/emprestimo.model';

/** Texto de cada acontecimento da linha do tempo. */
export const ROTULO_EVENTO: Record<TipoEventoEmprestimo, string> = {
  solicitado: 'Pedido solicitado',
  aprovado: 'Pedido aprovado',
  rejeitado: 'Pedido reprovado',
  cancelado: 'Pedido cancelado',
  retirado: 'Material retirado',
  transferencia_solicitada: 'Transferência solicitada',
  transferencia_aceita: 'Transferência aceita',
  transferencia_recusada: 'Transferência recusada',
  transferencia_cancelada: 'Transferência cancelada',
  devolvido: 'Material devolvido',
  avaria_registrada: 'Avaria registrada',
  falta_registrada: 'Falta registrada',
  manutencao_concluida: 'Unidade de volta ao estoque',
  manutencao_baixa: 'Baixa no acervo',
  expirado: 'Pedido expirado',
  suspensao_aplicada: 'Suspensão por atraso',
};

/** Ícone (Font Awesome) de cada acontecimento. */
export const ICONE_EVENTO: Record<TipoEventoEmprestimo, string> = {
  solicitado: 'fa-paper-plane',
  aprovado: 'fa-circle-check',
  rejeitado: 'fa-circle-xmark',
  cancelado: 'fa-ban',
  retirado: 'fa-hand-holding',
  transferencia_solicitada: 'fa-right-left',
  transferencia_aceita: 'fa-handshake',
  transferencia_recusada: 'fa-hand',
  transferencia_cancelada: 'fa-rotate-left',
  devolvido: 'fa-box-archive',
  avaria_registrada: 'fa-screwdriver-wrench',
  falta_registrada: 'fa-circle-question',
  manutencao_concluida: 'fa-circle-check',
  manutencao_baixa: 'fa-trash-can',
  expirado: 'fa-hourglass-end',
  suspensao_aplicada: 'fa-user-clock',
};

/** Tom de cor de cada acontecimento (vira a classe `tom-<valor>` na linha do tempo). */
export const TOM_EVENTO: Record<TipoEventoEmprestimo, 'ok' | 'erro' | 'info' | 'aviso' | 'neutro'> = {
  solicitado: 'neutro',
  aprovado: 'ok',
  rejeitado: 'erro',
  cancelado: 'neutro',
  retirado: 'info',
  transferencia_solicitada: 'aviso',
  transferencia_aceita: 'ok',
  transferencia_recusada: 'erro',
  transferencia_cancelada: 'neutro',
  devolvido: 'ok',
  avaria_registrada: 'aviso',
  falta_registrada: 'erro',
  manutencao_concluida: 'ok',
  manutencao_baixa: 'neutro',
  expirado: 'aviso',
  suspensao_aplicada: 'erro',
};
