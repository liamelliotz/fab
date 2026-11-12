/**
 * Situação de um pedido de empréstimo. Valores idênticos aos do front.
 *
 * Fluxo: pendente → aprovado → em_andamento → devolvido.
 * Saídas: rejeitado (reprovado pelo admin) e cancelado (desistência do solicitante).
 *
 * ATENÇÃO: `atrasado` NUNCA é gravado (nem na memória, nem no banco). Ele é calculado na
 * leitura por `statusParaResposta()` (emprestimos/atrasos/calcular-atraso.ts) e só aparece
 * na resposta da API. Assim existe uma única fonte da verdade: a data prevista de devolução.
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

/** Os status que podem ser gravados (todos, menos `atrasado`). */
export const STATUS_EMPRESTIMO_GRAVAVEIS = [
  StatusEmprestimo.Pendente,
  StatusEmprestimo.Aprovado,
  StatusEmprestimo.Rejeitado,
  StatusEmprestimo.EmAndamento,
  StatusEmprestimo.Devolvido,
  StatusEmprestimo.Cancelado,
] as const;
