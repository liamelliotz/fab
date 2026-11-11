import { StatusEmprestimo } from '../../common/enums/index.js';
import { hojeIso, paraIso } from '../../common/utils/data.util.js';
import type { Emprestimo } from '../entities/emprestimo.entity.js';

/**
 * Função pura: o empréstimo está atrasado?
 * Regra: status aprovado ou em_andamento E devolução prevista anterior a hoje.
 *
 * `hoje` aceita Date ou texto AAAA-MM-DD. O padrão é o dia de hoje NA ESCOLA (APP_TIMEZONE),
 * e não o dia do servidor. Como o formato é AAAA-MM-DD, comparar como texto funciona.
 */
export function calcularAtraso(
  emprestimo: Pick<Emprestimo, 'status' | 'dataPrevistaDevolucao'>,
  hoje: Date | string = hojeIso(),
): boolean {
  const ativo =
    emprestimo.status === StatusEmprestimo.Aprovado ||
    emprestimo.status === StatusEmprestimo.EmAndamento;
  if (!ativo) {
    return false;
  }
  const hojeTexto = typeof hoje === 'string' ? hoje : paraIso(hoje);
  return emprestimo.dataPrevistaDevolucao < hojeTexto;
}

/**
 * Status que vai na RESPOSTA da API: `atrasado` quando o prazo venceu, senão o status gravado.
 * É o único lugar em que `atrasado` nasce. Nunca grave o resultado desta função.
 */
export function statusParaResposta(
  emprestimo: Pick<Emprestimo, 'status' | 'dataPrevistaDevolucao'>,
  hoje: Date | string = hojeIso(),
): StatusEmprestimo {
  return calcularAtraso(emprestimo, hoje)
    ? StatusEmprestimo.Atrasado
    : emprestimo.status;
}
