# FAB · Frontend

Aplicação Angular do FAB. A visão geral do projeto, as telas e a instalação completa estão no
[README da raiz](../README.md).

## Como rodar

Use o Node.js 24. Todos os comandos são executados dentro de `frontend/`.

```bash
npm ci
npm run demo     # demonstração: não precisa de backend (dados no navegador)
npm start        # login real: suba o backend antes (porta 3000)
```

Acesse <http://localhost:4200>.

| Comando | Environment | `modoDemo` | Login |
| --- | --- | --- | --- |
| `npm run demo` | `environment.demo.ts` | `true` | Contas de exemplo, sem backend |
| `npm start` | `environment.development.ts` | `false` | JWT de verdade, pela API (`POST /auth/login`) |
| `npm run build` | `environment.ts` | `true` | Versão de produção (demonstração até a API cobrir todas as telas) |

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Coordenação | `admin@fab.com` | `admin123` |
| Professor | `professor@fab.com` | `prof123` |

> **Atenção:** no modo demonstração as contas de exemplo ficam no próprio navegador. Use-o só para apresentar e testar.

No modo demonstração, **Ctrl + Alt + Shift + R** restaura os dados iniciais. Com a API, nenhuma senha fica no
navegador e a sessão fica no `sessionStorage` (uma por aba, sobrevive ao F5).

## Verificar antes do Pull Request

```bash
npm run lint
npm test -- --watch=false
npm run build
```

O GitHub Actions roda os mesmos três comandos em todo Pull Request para a `main`.

## Telas e rotas

| Rota | Quem | Tela |
| --- | --- | --- |
| `/login`, `/recuperar-senha`, `/redefinir-senha` | Público | Entrar e criar uma nova senha pelo link (vale 30 min, uma vez) |
| `/dashboard` | Todos | Painel *O que fazer agora*, resumo do acervo e pedidos recentes |
| `/inventario/equipamentos` · `/inventario/insumos` | Professor | Inventário: pedir empréstimo ou insumo |
| `/meus-emprestimos` | Professor | Meus pedidos (abas Empréstimos e Insumos), código e QR de retirada |
| `/meus-emprestimos/nova` | Professor | Nova solicitação de empréstimo |
| `/pedidos/:id` | Todos | Detalhe do pedido e linha do tempo |
| `/configuracoes` | Todos | Dados da conta e senha |
| `/admin/solicitacoes` | Coordenação | Pedidos de empréstimo e requisições de insumo para analisar |
| `/admin/balcao` | Coordenação | Retirada e devolução por código ou QR, avarias e faltas |
| `/admin/emprestimos` | Coordenação | Empréstimos em andamento, prazos e atrasos |
| `/admin/inventario/equipamentos` · `/admin/inventario/insumos` | Coordenação | Acervo, estoque, valor, validade e movimentações |
| `/admin/equipamentos/novo` · `/:id/editar` · `/:id/historico` | Coordenação | Cadastro e histórico de cada equipamento |
| `/admin/manutencao` | Coordenação | Ocorrências, assistências credenciadas, conserto e baixa (inclusive parcial) |
| `/admin/mapa` | Coordenação | Onde está cada material, sala por sala |
| `/admin/auditoria` | Coordenação | Registro de todas as ações, com filtros e CSV |
| `/admin/usuarios` | Coordenação | Contas, perfis e habilitações |
| `/admin/relatorios` | Coordenação | Retiradas e consumo por período, com CSV |

As rotas são protegidas por `authGuard` (exige login) e `adminGuard` (exige o perfil de coordenação). O menu
mostra só o que o perfil pode abrir. Endereços antigos (`/materiais`, `/insumos`, `/admin/equipamentos`,
`/admin/insumos`) redirecionam para o Inventário.

## Estrutura

```text
src/
├── main.ts · main.server.ts · server.ts   bootstrap do app e do servidor SSR
├── styles.css                             tema global (cores, fonte, estados)
├── environments/                          modoDemo e apiUrl de cada modo
└── app/
    ├── app.routes.ts                      rotas principais
    ├── core/
    │   ├── guards/                        authGuard e adminGuard
    │   ├── interceptors/                  token JWT e tratamento de erros HTTP
    │   ├── models/                        contratos de dados (iguais aos da API)
    │   ├── services/                      regras de negócio e estado (signals)
    │   └── utils/                         datas, moeda, armazenamento
    ├── features/
    │   ├── auth/  dashboard/  equipamentos/  insumos/  emprestimos/  configuracoes/
    │   └── admin/                         telas da coordenação
    └── shared/
        ├── components/                    navbar, acessibilidade, termo de baixa, QR...
        ├── directives/                    diálogo acessível (foco preso e Esc)
        └── layouts/main-layout/           menu + área de conteúdo
```

## Convenções

- Componentes standalone, um por pasta (`.ts`, `.html`, `.css`), com o novo controle de fluxo (`@if`, `@for`).
- Estado com *signals*; formulários reativos.
- Textos da interface em português do Brasil, sem jargão técnico.
- Toda tela nova precisa funcionar só com o teclado, ter rótulos nos campos e passar no axe (WCAG AA).

## Acessibilidade e tema escuro

O botão **Acessibilidade** (no menu e na tela de login) escolhe o tema (claro, escuro ou automático) e liga fonte de leitura fácil, alto contraste, fonte maior, mais espaço no texto,
links sublinhados, foco reforçado, menos animação e o tradutor de Libras **VLibras**. O VLibras é carregado de
`vlibras.gov.br`; sem internet, ele não aparece e o resto do sistema segue funcionando. Para leitores de tela
como o **NVDA**, cada troca de página é anunciada e o link *Pular para o conteúdo* leva direto ao conteúdo.

## Ligar uma tela à API (`ApiService`)

`ApiService` usa `API_URL` do environment e entrega somente `dados` do envelope.
Métodos: `get<T>(caminho, filtros?)`, `post<T>(caminho, corpo, filtros?)`,
`patch<T>(caminho, corpo, filtros?)`, `put<T>(caminho, corpo, filtros?)` e
`delete<T>(caminho, filtros?)`. Filtros ignoram `null`, `undefined` e strings vazias;
`false` e `0` são preservados. Arrays viram parâmetros repetidos.

Exemplo de serviço de equipamentos (os imports ficam logo abaixo):

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

## Build, SSR e hospedagem

```bash
npm run build
npm run serve:ssr:frontend     # servidor Express na porta 4000 (ou em PORT)
```

Para publicar, configure `apiUrl` em `src/environments/environment.ts` com a URL HTTPS do backend
(terminando em `/api`), gere um novo build e cadastre a origem do frontend em `CORS_ORIGINS` no backend.
Se publicar em outro domínio, inclua-o em `security.allowedHosts` no `angular.json`.

### Cores e tema escuro

As cores dos componentes ficam em tokens (`var(--t-…)` texto, `var(--s-…)` fundo, `var(--b-…)` borda),
definidos em `src/styles/tema-cores.css` com a versão clara e a escura. **Criou CSS com cor fixa (`#1f6f4c`)?**
Rode dentro de `frontend/`:

```bash
python3 tools/gerar-tema.py
```

O script troca as cores fixas por tokens e calcula a versão escura. O tema claro não muda.
A fonte Inter, a Atkinson Hyperlegible e os ícones vêm pelo npm: nada depende de internet, exceto o VLibras.
