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

];