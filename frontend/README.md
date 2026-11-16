# FAB — Frontend

**FAB: Aprender, Organizar e Evoluir.**
Sistema web para controle e gestão de empréstimos de materiais e equipamentos escolares (notebooks, projetores, ferramentas, etc.).

Projeto Integrador do curso de Qualificação Profissional em Programador Full-Stack — SENAI, Centro de Formação Profissional de Macapá (2026).

## Sobre o projeto

Antes do FAB, o controle dos itens era manual, sem histórico de uso e com risco de extravio. O sistema permite:

- Consultar a disponibilidade dos equipamentos.
- Solicitar e acompanhar empréstimos.
- Controlar prazos de devolução e atrasos.
- Gerenciar acervo, manutenção, usuários e relatórios (área administrativa).

O nome faz alusão à avenida de maior fluxo de Macapá (AP).

## Tecnologias

- [Angular](https://angular.dev) com componentes standalone, *signals* e novo controle de fluxo (`@if` / `@for`)
- Angular SSR (renderização no servidor) com Express
- Formulários reativos (`ReactiveFormsModule`)
- TypeScript e CSS puro (fonte Inter)

## Como rodar

Pré-requisitos: Node.js (versão LTS recente) e Angular CLI.

```bash
cd frontend
npm install
ng serve
```

Acesse **http://localhost:4200**.

### Build e servidor SSR

```bash
ng build
```

Depois, sirva o resultado com o Node (o servidor Express escuta na porta **4000**, ou em `PORT`):

```bash
node dist/frontend/server/server.mjs
```

> O caminho acima assume o nome de projeto `frontend`. Confira o `outputPath` no `angular.json` ou um script `serve:ssr` no `package.json`.

O `angular.json` libera o host `localhost` em `security.allowedHosts`. Se publicar em outro domínio, inclua-o ali.

## Modo demonstração (sem backend)

Por padrão os dois environments mantêm `modoDemo: true`, preservando a demonstração local.
O login usa as contas do `UsuarioService` e os serviços de demonstração persistem os dados no navegador.
Somente o administrador cria usuários; não existe cadastro público.

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Administrador | `admin@fab.com` | `admin123` |
| Usuário (professor) | `professor@fab.com` | `prof123` |

O campo `modoDemo` fica em `src/environments/environment.ts` e
`environment.development.ts`. `AuthService` já lê essa opção; use `false` para testar
login real com o backend. Isso não migra os demais serviços de domínio para HTTP:
essa integração pertence aos próximos cards.

> **Atenção:** no modo demonstração as senhas ficam em texto puro no navegador. Nunca use em produção.

## Telas e rotas

| Rota | Quem acessa | Descrição |
| --- | --- | --- |
| `/login` | Público | Entrar no sistema |
| `/dashboard` | Todos | Métricas, atalhos e pedidos recentes |
| `/materiais` | Todos | Catálogo com filtros e botão *Solicitar empréstimo* |
| `/meus-emprestimos` | Todos | Acompanhamento dos próprios pedidos |
| `/meus-emprestimos/nova` | Todos | Formulário de nova solicitação |
| `/configuracoes` | Todos | Dados da conta, sair e sobre o projeto |
| `/admin/solicitacoes` | Admin | Aprovar ou reprovar pedidos |
| `/admin/emprestimos` | Admin | Controle de devoluções e atrasos |
| `/admin/equipamentos` | Admin | Cadastro, edição e ativação/desativação de itens |
| `/admin/manutencao` | Admin | Registro e andamento de manutenções |
| `/admin/insumos` | Admin | Tela provisória "Em construção" (D8) |
| `/admin/usuarios` | Admin | Lista de usuários e perfis |
| `/admin/relatorios` | Admin | Relatório de utilização por período, com exportação CSV |

A navbar lateral mostra apenas os links permitidos ao perfil. As rotas são protegidas por `authGuard` (exige login) e `adminGuard` (exige perfil admin).

## Estrutura de pastas

```
frontend/src/
├── main.ts / main.server.ts / server.ts   # bootstrap do app e do servidor SSR
├── styles.css                             # tema global (tokens, fonte, chips de status)
└── app/
    ├── app.routes.ts                      # rotas principais
    ├── app.routes.server.ts               # modo de renderização por rota (SSR)
    ├── core/
    │   ├── guards/                        # authGuard, adminGuard
    │   ├── interceptors/                  # token JWT e tratamento de erros HTTP
    │   ├── models/                        # contratos de dados (Usuário, Equipamento, Empréstimo...)
    │   ├── services/                      # auth, equipamento, emprestimo
    │   └── utils/                         # utilitários de data
    ├── features/
    │   ├── auth/                          # login e cadastro
    │   ├── dashboard/
    │   ├── equipamentos/                  # catálogo (lista, card, filtros)
    │   ├── emprestimos/                   # meus pedidos e nova solicitação
    │   ├── configuracoes/
    │   └── admin/                         # telas administrativas
    └── shared/
        ├── components/                    # navbar, card, button, input, badge-status
        └── layouts/main-layout/           # navbar + área de conteúdo
```

## Dados compartilhados (mocks)

Enquanto não há backend, dois serviços funcionam como fonte única de dados:

- `EquipamentoService` — acervo, catálogo e reserva de unidades.
- `EmprestimoService` — solicitações, aprovação/reprovação, cancelamento e prazos.

Assim, o que o admin cadastra aparece no catálogo, e aprovar um pedido reduz o estoque. Para integrar a API, troque a implementação desses serviços por chamadas `HttpClient`, mantendo os mesmos métodos.

## Convenções

- Componentes standalone, um por pasta (`.ts`, `.html`, `.css`).
- Estado local com *signals*; formulários com `FormBuilder` reativo.
- Textos da interface em português do Brasil.
- Commits no padrão `feat(escopo): descrição`.

## Equipe

- Alvaro Ronaldy Santos
- Ana Jolly Garcia da Silva
- Arthur Costa
- Jamilly Barbosa da Costa
- Leonardo Picanço Fontinele
- Liam Elliot Silva da Costa

Orientador: Instrutor especialista Matheus S Santos.

## Base HTTP (E3)

`ApiService` usa `API_URL` do environment e entrega somente `dados` do envelope.
Métodos: `get<T>(caminho, filtros?)`, `post<T>(caminho, corpo, filtros?)`,
`patch<T>(caminho, corpo, filtros?)`, `put<T>(caminho, corpo, filtros?)` e
`delete<T>(caminho, filtros?)`. Filtros ignoram `null`, `undefined` e strings vazias;
`false` e `0` são preservados. Arrays viram parâmetros repetidos.

Exemplo de serviço de equipamentos em cinco linhas (os imports ficam abaixo):

```ts
@Injectable({ providedIn: 'root' })
export class EquipamentosApiService {
  private readonly api = inject(ApiService);
  listar(filtros: FiltroEquipamentoDTO = {}) { return this.api.get<RespostaPaginada<Equipamento>>(ENDPOINTS.equipamentos.base, filtros); }
}
```

Imports do exemplo:

```ts
import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { ENDPOINTS } from '../constants/api.constants';
import { Equipamento, FiltroEquipamentoDTO } from '../models/equipamento.model';
import { RespostaPaginada } from '../models/pagination.model';
```

Um componente assina `listar().subscribe({ next: pagina => ... , error: erro => ... })`.
Os erros originais continuam chegando ao assinante; o interceptor já exibe `mensagem`
e a lista `erros` no alerta global (400 com validação permanece até ser fechado).
429 mostra aviso sem repetir a requisição. 401 encerra a sessão e volta ao login,
exceto quando já é uma tentativa de login; 403 em operação protegida volta ao dashboard.
Nenhum erro é escrito pelo interceptor em `console.warn` ou `console.error`.

`adminGuard` e o menu obtêm o perfil do token por `AuthService`; `fab_role` é apenas
compatibilidade e não concede acesso. O navegador só decodifica o JWT: assinatura e
permissões devem ser validadas pelo backend em cada requisição. Tokens ausentes,
malformados ou expirados não liberam a navegação no navegador.

### Conferência local

```bash
npm run build
npm test -- --watch=false
npm start
```

- Em demonstração, entrar como admin deve mostrar Insumos e abrir `/admin/insumos`.
- Entrar como professor, definir `localStorage.setItem('fab_role', 'admin')` no console,
  atualizar a página e abrir `/admin/insumos`: deve voltar ao dashboard.
- Com `modoDemo: false`, erro 400 de validação deve exibir o resumo e os campos no alerta.
- Os testes HTTP usam respostas controladas: não precisam de servidor nem alteram o banco.
