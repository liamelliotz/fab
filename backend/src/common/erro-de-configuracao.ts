/**
 * Erro de configuração da máquina (banco fora do ar, .env incompleto, valor inválido).
 *
 * Quando a API não sobe por um erro DESTE tipo, o main.ts mostra só a mensagem, que já diz
 * o que fazer. Qualquer outro erro aparece completo, com o stack trace, para facilitar a
 * investigação.
 */
export class ErroDeConfiguracao extends Error {
  override name = 'ErroDeConfiguracao';
}
