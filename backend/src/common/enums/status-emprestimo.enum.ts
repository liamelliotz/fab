/**
 * Situação de um pedido de empréstimo. Valores idênticos aos do front.
 *
 * Fluxo: pendente → aprovado → em_andamento → devolvido.
 * Saídas: rejeitado (reprovado pelo admin) e cancelado (desistência do solicitante).
 * `atrasado` é calculado pela data de devolução prevista (veja o Card 17).
 */
export enum StatusEmprestimo {
  Pendente = 'pendente',
  Aprovado = 'aprovado',
  Rejeitado = 'rejeitado',
  EmAndamento = 'em_andamento',
  Devolvido = 'devolvido',
  Atrasado = 'atrasado',
  Cancelado = 'cancelado',
}
