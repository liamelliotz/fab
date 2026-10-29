import { StatusEmprestimo } from '../../common/enums/index.js';

export interface ItemEmprestimo {
  equipamentoId: string;
  quantidade: number;
}

/** Datas no formato AAAA-MM-DD (veja docs/contrato-api.md). */
export class Emprestimo {
  id!: string;
  protocolo!: string; // EMP-AAAA-0001
  solicitanteId!: string;
  itens!: ItemEmprestimo[];
  dataRetirada!: string;
  dataDevolucaoPrevista!: string;
  dataRetiradaEfetiva?: string;
  dataDevolucaoEfetiva?: string;
  status!: StatusEmprestimo;
  motivoRejeicao?: string;
  avaliadoPor?: string;
  houveAvaria?: boolean;
  observacao?: string;
  criadoEm!: string;
}