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
    path: 'emprestimos',
    title: 'Empréstimos | FAB',
    loadComponent: () =>
      import('./emprestimos/admin-emprestimos').then((m) => m.AdminEmprestimos),
  },
  {
    path: 'equipamentos',
    title: 'Equipamentos | FAB',
    loadComponent: () =>
      import('./equipamentos/admin-equipamentos-lista').then((m) => m.AdminEquipamentosLista),
  },
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
  { path: '', redirectTo: 'solicitacoes', pathMatch: 'full' },
];
