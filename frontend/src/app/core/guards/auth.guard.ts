// - inject: permite injetar dependências (como serviços e rotas) sem precisar de construtor
// - CanActivateFn: tipo oficial do Angular para funções que protegem rotas
// - Router: serviço responsável pela navegação entre páginas
 import { inject } from '@angular/core';
 import { CanActivateFn, Router} from '@angular/router'

/**
 * AUTH GUARD:
 * Serve como um porteiro geral da aplicação.
 * Impede que pessoas que não fizeram login acessem páginas privadas (Dashboard, Solicitações, etc.).
 */
export const authGuard: CanActivateFn = (route, state) => {
    // Injeta o roteador para conseguirmos redirecionar o usuário se necessário
  const router = inject(Router);

    // Busca a chave de autenticação (token) gravada no navegador após o login
  const token = localStorage.getItem('fab_token');

//** REGRA 1: O usuário tem o token salvo? */
  if (token) {
    // Retorna 'true': a porta se abre e o Angular carrega a página solicitada
    return true; 
  }
//** REGRA 2: Se não existe token, ele é um intruso ou deslogou*/
    // Redireciona imediatamente para a tela de login
    router.navigate(['/login']);

    // Retorna 'false': cancela a tentativa de navegação na rota protegida
    return false;
};