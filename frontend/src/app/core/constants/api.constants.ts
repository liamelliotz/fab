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
    cadastro: '/auth/cadastro',
    recuperarSenha: '/auth/recuperar-senha',
    redefinirSenha: '/auth/redefinir-senha',
    me: '/auth/me',
  },
  usuarios: {
    base: '/usuarios',
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
    retirada: (id: string) => `/emprestimos/${id}/retirada`,
    devolucao: (id: string) => `/emprestimos/${id}/devolucao`,
  },
  manutencoes: {
    base: '/manutencoes',
    porId: (id: string) => `/manutencoes/${id}`,
  },
  dashboard: {
    resumo: '/dashboard/resumo',
  },
  relatorios: {
    utilizacao: '/relatorios/utilizacao',
  },
} as const;
