import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';

import { adminGuard } from './core/guards/admin.guard';

import { MainLayout } from './shared/layouts/main-layout/main-layout';

export const routes: Routes = [

  // =========================
  // ROTAS PÚBLICAS
  // =========================

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

  // O error.interceptor redireciona para /auth/login
  // quando a sessão expira.
  { path: 'auth/login', redirectTo: 'login' },

  // =========================
  // ADMIN
  // =========================

  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    loadChildren: () =>
      import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },

  // =========================
  // ROTAS INTERNAS
  // =========================

  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],

    children: [

      // Placeholder temporário
      { path: 'dashboard', children: [] },

      // Placeholder temporário
      { path: 'solicitacoes', children: [] },

      // Placeholder temporário
      { path: 'materiais', children: [] },

      // Placeholder temporário
      { path: 'configuracoes', children: [] },
    ],
  },

  // =========================
  // ROTA PADRÃO
  // =========================

  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // Qualquer rota inexistente volta para o login
  { path: '**', redirectTo: 'login' },

];