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
  {
    // Tela de cadastro (Card 7): o link "Cadastre-se" do login aponta para /cadastro
    path: 'cadastro',
    title: 'Cadastro | FAB',
    loadComponent: () => import('./features/auth/cadastro/cadastro').then((m) => m.Cadastro),
  },
  // O error.interceptor redireciona para /auth/login quando a sessão expira.
  // Este redirecionamento leva para o login real (os parâmetros da URL são mantidos).
  { path: 'auth/login', redirectTo: 'login' },
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
      {
        path: 'dashboard',
        title: 'Dashboard | FAB',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },

      // PLACEHOLDERS TEMPORÁRIOS: telas ainda não criadas.
      // Trocar por loadComponent/loadChildren quando existirem.
      { path: 'solicitacoes', children: [] },
      { path: 'materiais', children: [] },
      { path: 'configuracoes', children: [] },
    ],
  },
  { path: '**', redirectTo: 'login' },
];