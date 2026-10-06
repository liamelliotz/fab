import { Routes } from '@angular/router';
import { MainLayout } from './shared/layouts/main-layout/main-layout';

// ROTAS TEMPORÁRIAS: só para visualizar o navbar.
export const routes: Routes = [
  {
    path: '',
    component: MainLayout,
    children: [
      { path: 'dashboard', children: [] },
      { path: 'solicitacoes', children: [] },
      { path: 'emprestimos', children: [] },
      { path: 'relatorios', children: [] },
      { path: 'materiais', children: [] },
      { path: 'configuracoes', children: [] },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
];