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

Use Node.js 24. Os scripts npm usam a Angular CLI instalada no projeto.

```bash
cd frontend
npm ci
npm start        # login real: suba o backend antes (porta 3000)
npm run demo     # demonstração: não precisa de backend
```

Acesse **http://localhost:4200**.

### Build e servidor SSR

```bash
npm run build
```

Depois, sirva o resultado com o Node (o servidor Express escuta na porta **4000**, ou em `PORT`):

```bash
npm run serve:ssr:frontend
```

> O caminho acima assume o nome de projeto `frontend`. Confira o `outputPath` no `angular.json` ou um script `serve:ssr` no `package.json`.

O `angular.json` libera o host `localhost` em `security.allowedHosts`. Se publicar em outro domínio, inclua-o ali.

## Execução integrada e hospedagem

Suba primeiro o backend pelo [guia de instalação](../README.md) e confirme as chamadas reais no painel **Rede** do navegador. O endereço local da API é `http://localhost:3000/api`. O `npm start` já usa a API (`modoDemo: false` em `src/environments/environment.development.ts`); se a API estiver em outro endereço, ajuste `apiUrl` nesse arquivo. Confira quais telas da versão usada chamam a API antes do ensaio.

Para a publicação, quando a hospedagem for definida, configure `apiUrl` em `src/environments/environment.ts` com a URL HTTPS do backend, incluindo `/api`, e gere um novo build. Cadastre a origem publicada do frontend em `CORS_ORIGINS` no backend.

## Login real e modo demonstração

| Comando | Environment | `modoDemo` | Login |
| --- | --- | --- | --- |
| `npm start` | `environment.development.ts` | `false` | JWT de verdade, pela API (`POST /auth/login`) |
| `npm run demo` | `environment.demo.ts` | `true` | Contas do `UsuarioService`, sem backend (apresentação) |
| `npm run build` | `environment.ts` | `true` | Até o card E7, a versão de produção ainda é a demonstração |

Com o login real (card A6), a sessão fica no `sessionStorage` (uma por aba, sobrevive ao F5) e
nenhuma senha é gravada no navegador. As telas que ainda não foram ligadas à API continuam usando os
dados de exemplo do navegador; os ids das contas de exemplo são os mesmos do seed da API
(`usr-admin`, `usr-professor`, `usr-joao`...), então o professor logado de verdade vê os seus pedidos.
Usuários e Configurações (card A7) já usam a API: lista, busca e paginação no servidor, criar,
editar perfil, ativar, desativar, bloquear, habilitações e `GET /auth/me`. Com a API, nenhuma conta
nem senha fica no navegador.
As telas de Solicitações, Balcão e Empréstimos do admin já chamam a API: só funcionam com `npm start`
quando as rotas de empréstimos (cards C3 a C5) estiverem no backend; até lá, use `npm run demo`.

"Esqueci minha senha" (`/recuperar-senha` e `/redefinir-senha?token=...`) usa a API do card A5.
Nesta versão não há envio de e-mail: o link aparece no terminal da API.

Somente o administrador cria usuários; não existe cadastro público.

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Administrador | `admin@fab.com` | `admin123` |
| Usuário (professor) | `professor@fab.com` | `prof123` |

O campo `modoDemo` fica em `src/environments/`. O `AuthService` lê essa opção.

> **Atenção:** no modo demonstração as senhas ficam em texto puro no navegador. Nunca use em produção.

## Telas e rotas

| Rota | Quem acessa | Descrição |
| --- | --- | --- |
| `/login` | Público | Entrar no sistema |
| `/recuperar-senha` | Público | Pedir o link para criar uma nova senha |
| `/redefinir-senha?token=...` | Público | Criar a nova senha pelo link (vale 30 min, uma vez) |
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

- Em demonstração, entrar como admin deve mostrar Inventário e abrir `/admin/inventario/insumos`.
- Entrar como professor, definir `sessionStorage.setItem('fab_role', 'admin')` no console,
  atualizar a página e abrir `/admin/insumos`: deve voltar ao dashboard.
- Com `modoDemo: false`, erro 400 de validação deve exibir o resumo e os campos no alerta.
- Os testes HTTP usam respostas controladas: não precisam de servidor nem alteram o banco.
