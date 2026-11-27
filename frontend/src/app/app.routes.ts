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

  {
    path: 'recuperar-senha',
    title: 'Esqueci minha senha | FAB',
    loadComponent: () =>
      import('./features/auth/recuperar-senha/recuperar-senha').then((m) => m.RecuperarSenha),
  },
  {
    // O link que a API gera aponta para cá: /redefinir-senha?token=...
    path: 'redefinir-senha',
    title: 'Nova senha | FAB',
    loadComponent: () =>
      import('./features/auth/redefinir-senha/redefinir-senha').then((m) => m.RedefinirSenha),
  },

  // O error.interceptor redireciona para /auth/login quando a sessão expira
  { path: 'auth/login', redirectTo: 'login' },
  // Página inicial pública (apresenta o FAB; o botão leva ao login ou ao painel)
  {
    path: '',
    pathMatch: 'full',
    title: 'FAB | Gestão de equipamentos e insumos escolares',
    loadComponent: () => import('./features/inicio/inicio').then((m) => m.Inicio),
  },

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
        canActivateChild: [adminGuard],
        loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
      },

      // Todos os perfis
      {
        path: 'dashboard',
        title: 'Dashboard | FAB',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      // INVENTÁRIO: equipamentos (empréstimo) e insumos (consumo) numa aba só, com duas partes
      { path: 'inventario', redirectTo: 'inventario/equipamentos', pathMatch: 'full' },
      {
        path: 'inventario/equipamentos',
        title: 'Inventário · Equipamentos | FAB',
        loadComponent: () =>
          import('./features/equipamentos/lista/equipamento-lista').then((m) => m.EquipamentoLista),
      },
      {
        path: 'inventario/insumos',
        title: 'Inventário · Insumos | FAB',
        loadComponent: () => import('./features/insumos/insumos-professor').then((m) => m.InsumosProfessor),
      },
      // Endereços antigos continuam funcionando
      { path: 'materiais', redirectTo: 'inventario/equipamentos', pathMatch: 'full' },
      { path: 'insumos', redirectTo: 'inventario/insumos', pathMatch: 'full' },
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
