/** Acontecimentos da linha do tempo (auditoria) de um pedido. Iguais aos do front. */
export enum TipoEventoEmprestimo {
  Solicitado = 'solicitado',
  Aprovado = 'aprovado',
  Rejeitado = 'rejeitado',
  Cancelado = 'cancelado',
  Retirado = 'retirado',
  TransferenciaSolicitada = 'transferencia_solicitada',
  TransferenciaAceita = 'transferencia_aceita',
  TransferenciaRecusada = 'transferencia_recusada',
  TransferenciaCancelada = 'transferencia_cancelada',
  Devolvido = 'devolvido',
}
