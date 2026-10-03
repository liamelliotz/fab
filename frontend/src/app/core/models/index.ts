export * from './usuario.model';
export * from './equipamento.model';
export * from './emprestimo.model';
export * from './api-response.model';
export * from './pagination.model';
export * from './auth.model';

/**
 * ONDE IMPORTAR ESSES CONTRATOS:
 * 
 * 1. Services (`src/app/core/services/`):
 *    - `usuario.service.ts`: Utiliza `Usuario`, `ApiResponse` e `RespostaPaginada` para tipar as chamadas HTTP (ex.: Observable<ApiResponse<Usuario>>).
 *    - `equipamento.service.ts`: Utiliza `Equipamento`, `ApiResponse` e `RespostaPaginada` para listagens paginadas e operações de CRUD.
 *    - `emprestimo.service.ts`: Consome `Usuario` e `Equipamento` indiretamente nos retornos de empréstimo detalhados.
 * 
 * 2. Componentes de Features (`src/app/features/`):
 *    - `admin/equipamentos/admin-equipamentos-lista.ts`: Consome `Equipamento` e `RespostaPaginada<Equipamento>` para popular a tabela e controlar páginas.
 *    - `admin/equipamentos/admin-equipamentos-form.ts`: Utiliza `Equipamento` para carregar dados de edição no formulário.
 *    - `admin/usuarios/admin-usuarios.ts`: Consome `Usuario` e `RespostaPaginada<Usuario>` para exibir e filtrar os usuários cadastrados.
 *    - `equipamentos/lista/equipamento-lista.ts`: Utiliza `Equipamento` e `RespostaPaginada` para montar o catálogo público/disponível de itens.
 * 
 * 3. Componentes Compartilhados (`src/app/shared/components/`):
 *    - `table/table.ts`: Pode receber `RespostaPaginada<T>` ou coleções tipadas para renderização genérica.
 *    - `equipamento-card/equipamento-card.ts`: Recebe `@Input() equipamento!: Equipamento;` para exibição em grade/cards.
 * 
 * Exemplo de uso:
 * import { Usuario, Equipamento, ApiResponse, RespostaPaginada } from '@core/models';
 */