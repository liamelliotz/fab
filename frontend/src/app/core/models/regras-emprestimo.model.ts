/**
 * REGRAS DE EMPRÉSTIMO configuráveis pela coordenação (tela Configurações).
 * Rotas (backend): GET /regras-emprestimo (todos) e PUT /regras-emprestimo (somente admin).
 * Na demonstração ficam no navegador (RegrasEmprestimoService). Contrato em docs/contrato-regras-emprestimo.md.
 */
import { CategoriaEquipamento } from './equipamento.model';
import { UsuarioResumo } from './usuario.model';

/**
 * O que acontece quando alguém atrasa uma devolução.
 * - `aviso`: só avisa (o atraso fica registrado no pedido e no painel).
 * - `bloqueio`: enquanto houver material atrasado, a pessoa não faz pedidos novos.
 * - `suspensao`: bloqueio e, depois de devolver, a pessoa fica suspensa por
 *   (dias de atraso × fator) dias, de forma automática.
 */
export type PoliticaAtraso = 'aviso' | 'bloqueio' | 'suspensao';

export interface RegrasEmprestimo {
  /**
   * Dias de tolerância para retirar um pedido aprovado, contados da data de retirada prevista.
   * 0 = até o fim do próprio dia. Passou disso, o pedido expira e a reserva volta ao estoque.
   */
  diasParaRetirar: number;
  /** Unidades de cada categoria que uma pessoa pode ter ao mesmo tempo (pedidos abertos). null = sem limite. */
  limitePorCategoria: Record<CategoriaEquipamento, number | null>;
  politicaAtraso: PoliticaAtraso;
  /** Política `suspensao`: dias de suspensão para cada dia de atraso. */
  fatorSuspensao: number;
  /** Política `suspensao`: teto da suspensão, em dias. */
  maximoSuspensaoDias: number;
  atualizadoEm?: string;
  atualizadoPor?: UsuarioResumo;
}

/** Uma alteração das regras (só acréscimo; alimenta a auditoria). */
export interface AlteracaoRegras {
  id: string;
  em: string;
  por: UsuarioResumo;
  /** O que mudou, em português ("Política de atraso: Bloqueio → Suspensão automática"). */
  mudancas: string[];
}
