/**
 * Categorias do acervo de equipamentos (itens que são emprestados e DEVOLVIDOS).
 *
 * `consumivel` saiu daqui na v2: o que acaba e precisa ser reposto (filamento, solda,
 * papel) é INSUMO e mora no módulo `insumos/` (veja CategoriaInsumo).
 */
export enum CategoriaEquipamento {
  Ferramenta = 'ferramenta',
  Eletronico = 'eletronico',
  Impressora3d = 'impressora_3d',
  CorteLaser = 'corte_laser',
  Outros = 'outros',
}
