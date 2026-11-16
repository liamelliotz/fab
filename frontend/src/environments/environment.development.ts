/**
 * Configuração de DESENVOLVIMENTO (usada no `ng serve`).
 * Substitui o environment.ts via fileReplacements no angular.json.
 */
export const environment = {
  // Mantém a demonstração até a integração dos serviços de domínio.
  modoDemo: true,
  production: false,
  apiUrl: 'http://localhost:3000/api',
};
