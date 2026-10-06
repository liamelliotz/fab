import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { MainLayout } from './shared/layouts/main-layout/main-layout';

export const routes: Routes = [
  // Públicas (sem navbar)
  {
    path: 'login',
    title: 'Entrar | FAB',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // Internas (com navbar, exigem login)
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
      },

      // PLACEHOLDERS TEMPORÁRIOS: telas ainda não criadas.
      // Trocar por loadComponent/loadChildren quando existirem.
      { path: 'dashboard', children: [] },
      { path: 'solicitacoes', children: [] },
      { path: 'materiais', children: [] },
      { path: 'configuracoes', children: [] },
    ],
  },

  { path: '**', redirectTo: 'login' },
];