import { CategoriaEquipamento } from './equipamento.model';

/**
 * ASSISTÊNCIA TÉCNICA CREDENCIADA: empresa autorizada pela escola a consertar equipamentos.
 * Rotas (backend, futuro): GET/POST /assistencias e PATCH /assistencias/:id (somente admin).
 *
 * Só pode receber um equipamento quando está ATIVA, com o credenciamento DENTRO DO PRAZO e
 * com ESPECIALIDADE na categoria do equipamento. Isso evita mandar bem público para quem
 * não tem contrato ou não conserta aquele tipo de item.
 */
export interface AssistenciaTecnica {
  id: string;
  /** Nome conhecido, ex.: "Norte Informática". */
  nomeFantasia: string;
  razaoSocial: string;
  /** Só dígitos (14). Mostrado como 00.000.000/0000-00. */
  cnpj: string;
  /** Só dígitos (10 ou 11, com DDD). */
  telefone: string;
  email: string;
  endereco?: string;
  /** Categorias de equipamento que ela conserta. */
  especialidades: CategoriaEquipamento[];
  /** Último dia do credenciamento (AAAA-MM-DD). Depois disso não recebe novos equipamentos. */
  credenciadaAte: string;
  /** Número do contrato, ata ou processo de credenciamento. */
  contrato?: string;
  ativa: boolean;
  criadaEm: string;
  atualizadaEm?: string;
}

export type DadosAssistencia = Omit<AssistenciaTecnica, 'id' | 'ativa' | 'criadaEm' | 'atualizadaEm'>;
