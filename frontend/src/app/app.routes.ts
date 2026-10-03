import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'admin',
    loadChildren: () =>
      import('./features/admin/admin.routes')
        .then(m => m.ADMIN_ROUTES)
  },

  {
    path: '',
    redirectTo: 'admin/emprestimos',
    pathMatch: 'full'
  },

  {
    path: '**',
    redirectTo: 'admin/emprestimos'
  }
];