import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { MainLayout } from './shared/layouts/main-layout/main-layout';

export const routes: Routes = [
  // Rotas públicas (sem navbar)
  {
    path: 'login',
    title: 'Entrar | FAB',
    loadComponent: () =>
      import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    // Tela de cadastro
    path: 'cadastro',
    title: 'Cadastro | FAB',
    loadComponent: () =>
      import('./features/auth/cadastro/cadastro').then((m) => m.Cadastro),
  },

  // Redirecionamento para o login quando necessário
  { path: 'auth/login', redirectTo: 'login' },
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // Rotas internas (com navbar, exigem login)
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadChildren: () =>
          import('./features/admin/admin.routes').then(
            (m) => m.ADMIN_ROUTES,
          ),
      },
      {
        path: 'dashboard',
        title: 'Dashboard | FAB',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then(
            (m) => m.Dashboard,
          ),
      },

      // Placeholders temporários: telas ainda não implementadas
      { path: 'solicitacoes', children: [] },
      { path: 'materiais', children: [] },
      { path: 'configuracoes', children: [] },
    ],
  },

  // Redireciona endereços desconhecidos para o login
  { path: '**', redirectTo: 'login' },
];