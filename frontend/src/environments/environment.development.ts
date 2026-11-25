/**
 * Configuração de DESENVOLVIMENTO (usada no `npm start` / `ng serve`).
 * Substitui o environment.ts via fileReplacements no angular.json.
 *
 * modoDemo: false = o login usa a API de verdade (JWT). Suba o backend antes (porta 3000).
 * Para apresentar sem servidor, use `npm run demo` (environment.demo.ts).
 */
export const environment = {
  modoDemo: false,
  production: false,
  apiUrl: 'http://localhost:3000/api',
};
