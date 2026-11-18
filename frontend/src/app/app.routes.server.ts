import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'admin/equipamentos/:id/editar',
    renderMode: RenderMode.Client,
  },
  {
    // Histórico de um equipamento: depende do id e dos dados do navegador
    path: 'admin/equipamentos/:id/historico',
    renderMode: RenderMode.Client,
  },
  {
    // Detalhes de um pedido: depende do id e do usuário logado, então não é pré-renderizada
    path: 'pedidos/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
