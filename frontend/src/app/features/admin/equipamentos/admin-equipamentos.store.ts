// A lógica foi movida para core/services/equipamento.service.ts (fonte única de dados).
// Este arquivo mantém os nomes antigos para não quebrar os componentes de admin.
export {
  EquipamentoService as AdminEquipamentosStore,
  CATEGORIAS,
} from '../../../core/services/equipamento.service';
