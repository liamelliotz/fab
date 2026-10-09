import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
<<<<<<< HEAD

export const routes: Routes = [
=======
import { MainLayout } from './shared/layouts/main-layout/main-layout';

export const routes: Routes = [
  // Públicas (sem navbar)
>>>>>>> e8fd26ed5c3028f8a14892a85a399b66cdf8a8f2
  {
    path: 'login',
    title: 'Entrar | FAB',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
<<<<<<< HEAD
  },
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: 'emprestimo/detalhes',
    loadComponent: () =>
      import('./features/emprestimos/detalhes/emprestimo-detalhes').then(
        (m) => m.EmprestimoDetalhesComponent
      )
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
=======
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

      // PLACEHOLDERS TEMPORÁRIOS: telas ainda não criadas.
      // Trocar por loadComponent/loadChildren quando existirem.
      { path: 'dashboard', children: [] },
      { path: 'solicitacoes', children: [] },
      { path: 'materiais', children: [] },
      { path: 'configuracoes', children: [] },
    ],
  },

>>>>>>> e8fd26ed5c3028f8a14892a85a399b66cdf8a8f2
  { path: '**', redirectTo: 'login' },
];