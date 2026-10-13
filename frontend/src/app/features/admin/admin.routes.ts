/* import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  {
    path: 'emprestimos',
    loadComponent: () =>
      import('./emprestimos/admin-emprestimos')
        .then(m => m.AdminEmprestimos)
  },
  {
    path: '',
    redirectTo: 'emprestimos',
    pathMatch: 'full'
  }
]; */

import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  {
    path: 'emprestimos',
    loadComponent: () =>
      import('./emprestimos/admin-emprestimos')
        .then(m => m.AdminEmprestimos)
  },

  {
    path: 'manutencao',
    loadComponent: () =>
      import('./manutencao/admin-manutencao')
        .then(m => m.AdminManutencao)
  },

  {
    path: '',
    redirectTo: 'emprestimos',
    pathMatch: 'full'
  },

  {
  path: 'usuarios',
  loadComponent: () =>
    import('./usuarios/admin-usuarios')
      .then(m => m.AdminUsuarios)
},

{
  path: 'relatorios',
  loadComponent: () =>
    import('./relatorios/admin-relatorios')
      .then(m => m.AdminRelatorios)
},
   {
    path: 'solicitacoes',
    loadComponent: () =>
      import('./solicitacoes/admin-solicitacoes')
        .then(m => m.AdminSolicitacoes)
  },
  {
    path: 'equipamentos',
    loadComponent: () =>
      import('./equipamentos/admin-equipamentos-lista')
        .then(m => m.AdminEquipamentosLista)
  },
  {
    path: 'equipamentos/novo',
    loadComponent: () =>
      import('./equipamentos/admin-equipamentos-form')
        .then(m => m.AdminEquipamentosForm)
  },
  {
    path: 'equipamentos/:id/editar',
    loadComponent: () =>
      import('./equipamentos/admin-equipamentos-form')
        .then(m => m.AdminEquipamentosForm)
  },
];