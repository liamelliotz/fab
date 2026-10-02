// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './core/guard/auth.guard';
import { adminGuard } from './core/guard/admin.guard';

export const routes: Routes = [
    // Rotas públicas (sem guard)
  { path: 'login', loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent) },
  { path: 'cadastro', loadComponent: () => import('./features/auth/cadastro/cadastro.component').then(m => m.CadastroComponent) },

    // Rotas de utilizador comum (exigem apenas login)
  { 
    path: 'dashboard', 
    canActivate: [authGuard], 
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent) 
  },

    // Rotas restritas da administração/coordenação
  { 
    path: 'admin', 
    canActivate: [authGuard, adminGuard], 
    loadChildren: () => import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES) 
  },

  { path: '', redirectTo: 'login', pathMatch: 'full' }
];