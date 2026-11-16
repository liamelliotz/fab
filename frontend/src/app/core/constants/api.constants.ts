import { environment } from '../../../environments/environment';

/**
 * Endereço base da API (ex.: http://localhost:3000/api).
 * Vem do arquivo de ambiente, então nenhum service precisa escrever a URL à mão.
 */
export const API_URL = environment.apiUrl;

/**
 * Caminhos de TODAS as rotas do backend, relativos ao API_URL.
 * Os caminhos seguem a tabela da seção 3 do plano do backend (docs/contrato-api.md).
 *
 * Exemplo de uso em um service:
 *   this.http.get(`${API_URL}${ENDPOINTS.equipamentos.base}`);
 *   this.http.patch(`${API_URL}${ENDPOINTS.emprestimos.avaliar(id)}`, dto);
 */
export const ENDPOINTS = {
  auth: {
    login: '/auth/login',
    recuperarSenha: '/auth/recuperar-senha',
    redefinirSenha: '/auth/redefinir-senha',
    me: '/auth/me',
  },
  usuarios: {
    base: '/usuarios',
    resumo: '/usuarios/resumo',
    habilitacoes: (id: string) => `/usuarios/${id}/habilitacoes`,
    porId: (id: string) => `/usuarios/${id}`,
    status: (id: string) => `/usuarios/${id}/status`,
  },
  equipamentos: {
    base: '/equipamentos',
    porId: (id: string) => `/equipamentos/${id}`,
    ativo: (id: string) => `/equipamentos/${id}/ativo`,
  },
  emprestimos: {
    base: '/emprestimos',
    meus: '/emprestimos/meus',
    porId: (id: string) => `/emprestimos/${id}`,
    avaliar: (id: string) => `/emprestimos/${id}/avaliar`,
    cancelar: (id: string) => `/emprestimos/${id}/cancelar`,
    balcao: {
      consulta: '/emprestimos/balcao/consulta',
      retirada: '/emprestimos/balcao/retirada',
      devolucao: '/emprestimos/balcao/devolucao',
    },
    transferencia: (id: string) => `/emprestimos/${id}/transferencia`,
    aceitarTransferencia: (id: string) => `/emprestimos/${id}/transferencia/aceitar`,
    recusarTransferencia: (id: string) => `/emprestimos/${id}/transferencia/recusar`,
  },
  manutencoes: {
    base: '/manutencoes',
    porId: (id: string) => `/manutencoes/${id}`,
  },
  insumos: {
    base: '/insumos',
    aRepor: '/insumos/a-repor',
    porId: (id: string) => `/insumos/${id}`,
    ativo: (id: string) => `/insumos/${id}/ativo`,
    movimentacoes: '/insumos/movimentacoes',
    movimentar: (id: string) => `/insumos/${id}/movimentacoes`,
    relatorioConsumo: '/insumos/relatorios/consumo',
  },
  dashboard: {
    resumo: '/dashboard/resumo',
  },
  relatorios: {
    utilizacao: '/relatorios/utilizacao',
  },
} as const;
