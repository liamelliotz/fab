import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * ADMIN GUARD:
 * Serve para controle de níveis de acesso (RBAC - Role-Based Access Control).
 * Garante que apenas gestores/coordenadores acessem o painel administrativo da FAB,
 * impedindo que alunos ou usuários comuns acessem rotas de cadastro ou relatórios gerais.
 */

export const adminGuard: CanActivateFn = (route, state) => {
    const router = inject(Router);

    // Pega o token para confirmar se está autenticado
    const token = localStorage.getItem('fab_token');

    // Pega o tipo de cargo/perfil salvo no login (ex: 'ADMIN', 'ALUNO', 'PROFESSOR')
    const role = localStorage.getItem('fab_role');

//** REGRA 1: Está logado E possui o perfil de 'Admin'?*/
    if (token && role === 'Admin') {
    // Permite a entrada na rota restrita de administração
        return true;
    }

//** REGRA 2: O usuário está logado, mas NÃO é administrador (ex: é um aluno comum) */
    if (token) {
    // Não deixamos ele no admin, mandamos ele para o painel principal comum
        router.navigate(['/dashboard']);
        return false;
    }

//** REGRA 3: Se nem logado ele estiver, manda de volta ao início */
    router.navigate(['/login']);
    return false;
};