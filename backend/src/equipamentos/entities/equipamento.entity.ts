import {
  CategoriaEquipamento,
  StatusEquipamento,
} from '../../common/enums/index.js';

export interface Equipamento {
  id: string;
  nome: string;
  patrimonio: string;
  categoria: CategoriaEquipamento;
  descricao: string;
  quantidadeTotal: number;
  quantidadeDisponivel: number;
  status: StatusEquipamento;
  ativo: boolean;
  criadoEm: string;
}