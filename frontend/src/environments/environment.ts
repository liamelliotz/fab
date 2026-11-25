/**
 * Configuração de PRODUÇÃO (usada por padrão no `ng build`).
 * apiUrl: endereço base da API do backend (já inclui o prefixo /api).
 * TODO: ao hospedar o backend, troque pelo endereço real.
 */
export const environment = {
  // Mantém a demonstração até a integração dos serviços de domínio.
  modoDemo: true,
  production: true,
  apiUrl: 'http://localhost:3000/api',
};
