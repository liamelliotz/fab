import { Routes } from '@angular/router';

// Rotas da área administrativa (prefixo /admin, protegido pelo adminGuard em app.routes.ts)
export const ADMIN_ROUTES: Routes = [
  {
    path: 'solicitacoes',
    title: 'Solicitações | FAB',
    loadComponent: () =>
      import('./solicitacoes/admin-solicitacoes').then((m) => m.AdminSolicitacoes),
  },
  {
    path: 'balcao',
    title: 'Balcão | FAB',
    loadComponent: () => import('./balcao/admin-balcao').then((m) => m.AdminBalcao),
  },
  {
    path: 'emprestimos',
    title: 'Empréstimos | FAB',
    loadComponent: () =>
      import('./emprestimos/admin-emprestimos').then((m) => m.AdminEmprestimos),
  },
  // INVENTÁRIO: equipamentos e insumos (duas partes da mesma aba)
  { path: 'inventario', redirectTo: 'inventario/equipamentos', pathMatch: 'full' },
  {
    path: 'inventario/equipamentos',
    title: 'Inventário · Equipamentos | FAB',
    loadComponent: () =>
      import('./equipamentos/admin-equipamentos-lista').then((m) => m.AdminEquipamentosLista),
  },
  {
    path: 'inventario/insumos',
    title: 'Inventário · Insumos | FAB',
    loadComponent: () => import('./insumos/admin-insumos').then((m) => m.AdminInsumos),
  },
  // Endereços antigos continuam funcionando
  { path: 'equipamentos', redirectTo: 'inventario/equipamentos', pathMatch: 'full' },
  { path: 'insumos', redirectTo: 'inventario/insumos', pathMatch: 'full' },
  {
    path: 'equipamentos/novo',
    title: 'Novo equipamento | FAB',
    loadComponent: () =>
      import('./equipamentos/admin-equipamentos-form').then((m) => m.AdminEquipamentosForm),
  },
  {
    path: 'equipamentos/:id/editar',
    title: 'Editar equipamento | FAB',
    loadComponent: () =>
      import('./equipamentos/admin-equipamentos-form').then((m) => m.AdminEquipamentosForm),
  },
  {
    path: 'equipamentos/:id/historico',
    title: 'Histórico do equipamento | FAB',
    loadComponent: () =>
      import('./equipamentos/admin-equipamento-historico').then((m) => m.AdminEquipamentoHistorico),
  },
  {
    path: 'manutencao',
    title: 'Manutenção | FAB',
    loadComponent: () =>
      import('./manutencao/admin-manutencao').then((m) => m.AdminManutencao),
  },
  {
    path: 'usuarios',
    title: 'Usuários | FAB',
    loadComponent: () => import('./usuarios/admin-usuarios').then((m) => m.AdminUsuarios),
  },
  {
    path: 'relatorios',
    title: 'Relatórios | FAB',
    loadComponent: () =>
      import('./relatorios/admin-relatorios').then((m) => m.AdminRelatorios),
  },
  {
    path: 'mapa',
    title: 'Mapa de itens | FAB',
    loadComponent: () => import('./mapa/admin-mapa').then((m) => m.AdminMapa),
  },
  {
    path: 'auditoria',
    title: 'Auditoria | FAB',
    loadComponent: () => import('./auditoria/admin-auditoria').then((m) => m.AdminAuditoria),
  },
  { path: '', redirectTo: 'solicitacoes', pathMatch: 'full' },
];
