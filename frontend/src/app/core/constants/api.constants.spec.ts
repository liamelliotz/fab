import { ENDPOINTS } from './api.constants';

/** Independent inventory of section 3 of docs/contrato-api.md (distinct paths). */
const caminhosDoContrato = [
  '/auth/login', '/auth/me', '/auth/recuperar-senha', '/auth/redefinir-senha',
  '/usuarios', '/usuarios/resumo', '/usuarios/:id', '/usuarios/:id/status', '/usuarios/:id/habilitacoes',
  '/equipamentos', '/equipamentos/:id', '/equipamentos/:id/ativo',
  '/manutencoes', '/manutencoes/:id',
  '/emprestimos', '/emprestimos/meus', '/emprestimos/:id',
  '/emprestimos/:id/avaliar', '/emprestimos/:id/cancelar',
  '/emprestimos/balcao/consulta', '/emprestimos/balcao/retirada', '/emprestimos/balcao/devolucao',
  '/emprestimos/:id/transferencia', '/emprestimos/:id/transferencia/aceitar', '/emprestimos/:id/transferencia/recusar',
  '/insumos', '/insumos/a-repor', '/insumos/:id', '/insumos/:id/ativo',
  '/insumos/:id/movimentacoes', '/insumos/movimentacoes', '/insumos/relatorios/consumo',
  '/dashboard/resumo', '/relatorios/utilizacao',
];

function caminhos(valor: unknown): string[] {
  if (typeof valor === 'string') return [valor];
  if (typeof valor === 'function') return [valor(':id')];
  return Object.values(valor as Record<string, unknown>).flatMap(caminhos);
}

describe('ENDPOINTS e contrato v2', () => {
  it('cobre todos os caminhos do contrato, sem rotas antigas ou extras', () => {
    expect(caminhos(ENDPOINTS).sort()).toEqual([...caminhosDoContrato].sort());
  });
});
