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

Por padrão o app roda **sem API**: o login e o cadastro usam contas guardadas no `localStorage` do navegador, e os dados (equipamentos, solicitações) são mocks em memória, reiniciados a cada recarregamento da página.

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Administrador | `admin@fab.com` | `admin123` |
| Usuário (professor) | `professor@fab.com` | `prof123` |

Quem se cadastra em `/cadastro` vira usuário comum e entra direto no dashboard.

Para usar a API real, edite `src/app/core/services/auth.service.ts`:

```ts
const API_URL = 'http://localhost:3000/api';
const MODO_DEMO: boolean = false;
```

> **Atenção:** no modo demonstração as senhas ficam em texto puro no navegador. Nunca use em produção.

## Telas e rotas

| Rota | Quem acessa | Descrição |
| --- | --- | --- |
| `/login`, `/cadastro` | Público | Entrar e criar conta |
| `/dashboard` | Todos | Métricas, atalhos e pedidos recentes |
| `/materiais` | Todos | Catálogo com filtros e botão *Solicitar empréstimo* |
| `/meus-emprestimos` | Todos | Acompanhamento dos próprios pedidos |
| `/meus-emprestimos/nova` | Todos | Formulário de nova solicitação |
| `/configuracoes` | Todos | Dados da conta, sair e sobre o projeto |
| `/admin/solicitacoes` | Admin | Aprovar ou reprovar pedidos |
| `/admin/emprestimos` | Admin | Controle de devoluções e atrasos |
| `/admin/equipamentos` | Admin | Cadastro, edição e ativação/desativação de itens |
| `/admin/manutencao` | Admin | Registro e andamento de manutenções |
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