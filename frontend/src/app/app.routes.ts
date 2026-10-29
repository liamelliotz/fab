import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { MainLayout } from './shared/layouts/main-layout/main-layout';

export const routes: Routes = [
  // Rotas públicas (sem navbar)
  {
    path: 'login',
    title: 'Entrar | FAB',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },

  // O error.interceptor redireciona para /auth/login quando a sessão expira
  { path: 'auth/login', redirectTo: 'login' },
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // Rotas internas (com navbar, exigem login)
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [
      // Área administrativa: /admin/solicitacoes, /admin/balcao, /admin/emprestimos,
      // /admin/equipamentos, /admin/manutencao, /admin/usuarios e /admin/relatorios
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
      },

      // Todos os perfis
      {
        path: 'dashboard',
        title: 'Dashboard | FAB',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'materiais',
        title: 'Materiais | FAB',
        loadComponent: () =>
          import('./features/equipamentos/lista/equipamento-lista').then((m) => m.EquipamentoLista),
      },
      {
        path: 'meus-emprestimos',
        title: 'Meus pedidos | FAB',
        loadComponent: () =>
          import('./features/emprestimos/meus-emprestimos/meus-emprestimos').then(
            (m) => m.MeusEmprestimos,
          ),
      },
      {
        path: 'meus-emprestimos/nova',
        title: 'Nova solicitação | FAB',
        loadComponent: () =>
          import('./features/emprestimos/solicitar/emprestimo-solicitar').then(
            (m) => m.EmprestimoSolicitar,
          ),
      },
      // Detalhes de um pedido (código/QR, responsáveis e linha do tempo). O professor vê só os
      // pedidos em que participa; a coordenação vê todos (a própria tela confere).
      {
        path: 'pedidos/:id',
        title: 'Pedido | FAB',
        loadComponent: () =>
          import('./features/emprestimos/detalhes/emprestimo-detalhes').then(
            (m) => m.EmprestimoDetalhes,
          ),
      },
      {
        path: 'configuracoes',
        title: 'Configurações | FAB',
        loadComponent: () =>
          import('./features/configuracoes/configuracoes').then((m) => m.Configuracoes),
      },

      // Atalho antigo: a tela de solicitações agora fica em /admin/solicitacoes
      { path: 'solicitacoes', redirectTo: 'admin/solicitacoes', pathMatch: 'full' },
    ],
  },

  // Redireciona endereços desconhecidos para o login
  { path: '**', redirectTo: 'login' },
];
