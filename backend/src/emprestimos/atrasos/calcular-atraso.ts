import { StatusEmprestimo } from '../../common/enums/index.js';
import type { Emprestimo } from '../entities/emprestimo.entity.js';

/** Converte uma data para AAAA-MM-DD, no horário local. */
export function paraIso(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * Função pura: o empréstimo está atrasado?
 * Regra: status aprovado ou em_andamento E devolução prevista anterior a hoje.
 * Usada por C (listagens) e D (tarefa diária, dashboard, devolução).
 *
 * `hoje` aceita Date ou texto AAAA-MM-DD. Como o formato é AAAA-MM-DD,
 * comparar como texto funciona e evita problemas de fuso horário.
 */
export function calcularAtraso(
  emprestimo: Pick<Emprestimo, 'status' | 'dataDevolucaoPrevista'>,
  hoje: Date | string = new Date(),
): boolean {
  const ativo =
    emprestimo.status === StatusEmprestimo.Aprovado ||
    emprestimo.status === StatusEmprestimo.EmAndamento;
  if (!ativo) {
    return false;
  }
  const hojeIso = typeof hoje === 'string' ? hoje : paraIso(hoje);
  return emprestimo.dataDevolucaoPrevista < hojeIso;
}