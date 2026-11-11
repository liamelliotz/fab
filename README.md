<div align="center">

# 🎒 FAB — Aprender, Organizar e Evoluir

![Angular](https://img.shields.io/badge/Angular_22-Frontend-DD0031?style=for-the-badge&logo=angular&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS_12-Backend-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_16-Banco-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Linguagem-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js_24-LTS-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Status](https://img.shields.io/badge/status-em_desenvolvimento-yellow?style=for-the-badge)

**Sistema web para controlar o empréstimo de equipamentos escolares e o estoque de insumos**,
desenvolvido para a **Escola Estadual Mayra do Carmo**.

**Projeto Integrador** · Qualificação Profissional em Programador Full Stack
**Instituição:** SENAI — Centro de Formação Profissional de Macapá
**Equipe:** Team Rocket Projects · **Orientador:** Instrutor Matheus S. Santos

</div>

---

## 📌 Sumário

1. [Sobre o projeto](#1--sobre-o-projeto)
2. [Tecnologias](#2--tecnologias)
3. [Estrutura do repositório](#3--estrutura-do-repositório)
4. [Começando em 5 minutos](#4--começando-em-5-minutos)
5. [Banco de dados](#5--banco-de-dados)
6. [Comandos do dia a dia](#6--comandos-do-dia-a-dia)
7. [Documentação](#7--documentação)
8. [Fluxo de trabalho com Git](#8--fluxo-de-trabalho-com-git)
9. [Solução de problemas](#9--solução-de-problemas)
10. [Equipe](#10--equipe)
11. [Status do projeto](#11--status-do-projeto)

---

## 1. 🎯 Sobre o projeto

### O problema

O empréstimo de equipamentos pedagógicos é feito em planilha ou por acordo verbal. Não há controle de
quem está com cada item, de prazos, de devoluções nem de avarias. Os materiais de consumo acabam sem aviso.

### A solução

O FAB cobre o ciclo completo do empréstimo e o estoque de insumos:

| Etapa | O que acontece |
| :--- | :--- |
| **1. Solicitar** | O professor escolhe o material, informa as datas (dentro do prazo máximo do item) e a justificativa pedagógica |
| **2. Aprovar** | A coordenação analisa; ao aprovar, o estoque é reservado |
| **3. Código e QR** | O professor recebe um código exclusivo de retirada |
| **4. Balcão** | O responsável confere o código e entrega; o pedido passa a "em uso" |
| **5. Transferir** | O material pode ir para outro professor, com aceite e sem mudar o prazo |
| **6. Devolver** | Avarias são registradas e o item volta ao estoque (ou vai para manutenção) |

Cada passo fica gravado na **linha do tempo** do pedido, que nunca é editada nem apagada.

**Insumos** (filamento, solda, papel) têm controle próprio: entradas e saídas com responsável e motivo,
saldo que nunca fica negativo, alerta de estoque baixo e previsão de quando o item vai acabar.

### Perfis de usuário

| Perfil | O que faz |
| :--- | :--- |
| **Professor** (`usuario`) | Consulta o acervo, solicita, acompanha e transfere os próprios empréstimos |
| **Administrador** (`admin`) | Cria contas, aprova pedidos, opera o balcão, cuida de manutenção, insumos e relatórios |

Só a coordenação cria contas: não existe cadastro público.

---

## 2. 🧰 Tecnologias

| Camada | Tecnologia | Onde |
| :--- | :--- | :--- |
| **Frontend** | Angular 22 (com SSR) | `frontend/` |
| **Backend** | NestJS 12, em ESM | `backend/` |
| **Banco de dados** | PostgreSQL 16 (Docker Compose) | `docker-compose.yml` e `backend/database/` |
| **Autenticação** | JWT (passport-jwt) e senhas com bcrypt | `backend/src/auth/` |
| **Testes** | Vitest e Supertest | `backend/src/**/*.spec.ts` e `backend/test/` |
| **Qualidade** | oxlint e Prettier | `npm run lint` e `npm run format` |
| **Documentação da API** | Swagger | <http://localhost:3000/api/docs> |
| **Gestão** | Trello (Kanban) e GitHub (Pull Requests) | — |

---

## 3. 📁 Estrutura do repositório

```text
fab/
├── backend/               # API NestJS
│   ├── database/          #   migrations em SQL
│   ├── src/               #   um módulo por pasta (auth, usuarios, equipamentos, emprestimos,
│   │                      #   manutencoes, insumos, dashboard, relatorios) e a pasta common/
│   └── test/              #   testes de ponta a ponta
├── frontend/              # Aplicação Angular
├── docs/                  # Contrato da API, banco de dados e roteiro da demonstração
├── docker-compose.yml     # PostgreSQL 16 para desenvolvimento
└── README.md
```

`frontend/` e `backend/` são projetos independentes, cada um com o seu `package.json`.

---

## 4. 🚀 Começando em 5 minutos

### 4.1 O que instalar

| Ferramenta | Versão | Conferir com |
| :--- | :--- | :--- |
| **Node.js** | 24 LTS (traz o npm 11) | `node -v` |
| **Git** | 2.30 ou superior | `git --version` |
| **Docker Desktop** | atual (só para o banco) | `docker -v` |

```powershell
# Windows (PowerShell)
winget install OpenJS.NodeJS.LTS Git.Git Docker.DockerDesktop
```

```bash
# macOS (Homebrew)
brew install node git && brew install --cask docker

# Linux (Ubuntu/Debian): use o nvm, não o Node do apt
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
nvm install --lts
```

### 4.2 Clonar e instalar

```bash
git clone https://github.com/liamelliotz/fab.git
cd fab
```

### 4.3 Backend

```bash
cd backend
npm ci
cp .env.example .env         # Windows (PowerShell): Copy-Item .env.example .env
npm run start:dev
```

- API: <http://localhost:3000/api>
- Swagger: <http://localhost:3000/api/docs>

A API sobe mesmo sem o banco: por enquanto os dados ficam em memória e são recriados a cada reinício.

### 4.4 Frontend

Em **outro terminal**:

```bash
cd frontend
npm ci
npm start
```

Abra <http://localhost:4200>.

### 4.5 Contas de teste

| Conta | E-mail | Senha |
| :--- | :--- | :--- |
| Administrador | `admin@fab.com` | `admin123` |
| Professor | `professor@fab.com` | `prof123` |
| Colegas (João, Maria, Carlos, Ana) | `joao@escola.br` etc. | `prof123` |

No Swagger: chame `POST /auth/login`, copie o `tokenAcesso`, clique em **Authorize** e cole.

### 4.6 Portas

| Serviço | Porta |
| :--- | :--- |
| Frontend | 4200 |
| Backend | 3000 |
| PostgreSQL | 5432 |

---

## 5. 💾 Banco de dados

```bash
docker compose up -d         # na raiz: sobe o PostgreSQL 16
cd backend
npm run db:migrate           # cria as tabelas
npm run db:seed              # APAGA os dados e grava os de exemplo
```

`npm run db:reset` faz migrate e seed de uma vez. Para apagar tudo e recomeçar: `docker compose down -v`.

As tabelas são criadas por arquivos SQL em `backend/database/migrations/`. O próprio banco garante as
regras mais importantes: saldo de insumo nunca negativo, estoque de equipamento dentro do total,
protocolo sem repetição e histórico que não pode ser alterado. O diagrama completo está em
[`docs/banco.md`](docs/banco.md).

---

## 6. 💻 Comandos do dia a dia

### Backend (dentro de `backend/`)

| Comando | O que faz |
| :--- | :--- |
| `npm run start:dev` | Sobe a API e reinicia ao salvar |
| `npm run format` | Formata o código (Prettier) |
| `npm run lint` | Verifica o código (oxlint) |
| `npm test` | Testes unitários |
| `npm run test:e2e` | Testes de ponta a ponta |
| `npm run build` | Compila para `dist/` |
| `npm run db:migrate` · `db:seed` · `db:reset` | Banco de dados |

### Frontend (dentro de `frontend/`)

| Comando | O que faz |
| :--- | :--- |
| `npm start` | Sobe o front e recarrega ao salvar |
| `npm run build` | Gera a versão de produção |
| `npm test` | Testes unitários |

---

## 7. 📚 Documentação

| Documento | Para quê |
| :--- | :--- |
| [`docs/contrato-api.md`](docs/contrato-api.md) | **Contrato único da API**: rotas, entradas, saídas, erros e regras de negócio |
| [`docs/banco.md`](docs/banco.md) | Diagrama ER, travas do banco e como criar uma migration |
| [`docs/demo-fab.md`](docs/demo-fab.md) | Roteiro da demonstração |
| [`docs/MUDANCAS-v2.md`](docs/MUDANCAS-v2.md) | O que mudou na v2, arquivo por arquivo |
| [`backend/README.md`](backend/README.md) | Variáveis do `.env`, estrutura e regras do backend |
| [`backend/src/auth/README.md`](backend/src/auth/README.md) | Como proteger ou liberar uma rota |
| [`backend/src/common/README.md`](backend/src/common/README.md) | Envelope, paginação, repositórios e seeds |

---

## 8. 🔀 Fluxo de trabalho com Git

Ninguém trabalha direto na `main`. Cada card do Trello vira uma branch e um Pull Request.

```bash
git checkout main && git pull        # 1. atualize
npm ci                               # 2. instale o que mudou (em backend/ ou frontend/)
git checkout -b feature/d2-movimentacoes   # 3. branch com o código do card

# ... edite só as pastas do seu card ...

npm run format && npm run lint && npm test && npm run test:e2e   # 4. confira (backend)
git add . && git commit -m "feat(insumos): registra entradas e saídas"
git pull --rebase origin main        # 5. traga o que entrou na main
git push -u origin feature/d2-movimentacoes
# 6. abra o Pull Request e peça a revisão
```

### Mensagens de commit

| Prefixo | Uso |
| :--- | :--- |
| `feat(modulo):` | Nova funcionalidade |
| `fix(modulo):` | Correção de erro |
| `test(modulo):` | Testes |
| `docs:` | Documentação |
| `refactor(modulo):` | Reorganização sem mudar o comportamento |
| `chore:` | Configuração e manutenção |

### Regras

- ✅ Um card por vez: só comece o próximo depois do merge do anterior
- ✅ Edite só as pastas do seu módulo; um módulo usa o outro pelo **service exportado**
- ✅ Todo card de backend entrega os seus testes
- ✅ Mudou uma rota? Atualize `docs/contrato-api.md` no mesmo Pull Request
- 🚫 Nunca envie `.env`, senhas, `node_modules/` nem `dist/`

---

## 9. 🧯 Solução de problemas

| Problema | Solução |
| :--- | :--- |
| `npm ci` reclama que o `package-lock.json` está fora de sincronia | Você está com npm 10. Atualize para o Node 24 (`node -v`) |
| Toda rota responde **401** | É o esperado sem token. Faça `POST /auth/login` e envie `Authorization: Bearer <token>` |
| Login responde **429** | Foram mais de 5 tentativas em 1 minuto. Aguarde |
| `db:migrate` não conecta | O banco não está no ar: `docker compose up -d` na raiz e confira o `DATABASE_URL` do `.env` |
| A API não sobe em produção: "JWT_SECRET ausente ou fraco" | Gere um segredo: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `Cannot find module './x.service'` no backend | O projeto é ESM: o `import` local termina em `.js` |
| `EADDRINUSE :::3000` ou `Port 4200 is already in use` | Feche o outro processo ou mude a `PORT` no `.env` (front: `ng serve --port 4300`) |
| `Port 5432 is already allocated` | Já existe um PostgreSQL na máquina. Pare-o ou mude a porta no `docker-compose.yml` e no `.env` |
| PowerShell: "execução de scripts desabilitada" | `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` ou use o Git Bash |
| `git pull` recusa: "would be overwritten" | Salve antes: `git stash`, depois `git pull` e `git stash pop` |
| Conflito no meio de um rebase | Resolva os arquivos marcados, `git add` e `git rebase --continue`. Para desistir: `git rebase --abort` |
| Arquivos aparecem todos modificados no Windows | `git config --global core.autocrlf true` |
| Erros estranhos depois de trocar de branch | Apague `node_modules` e rode `npm ci` |

---

## 10. 👥 Equipe

**Team Rocket Projects**

| Integrante | Papel | Responsabilidades principais |
| :--- | :--- | :--- |
| Liam Elliot Silva da Costa | Gerente de Projeto | Cronograma, coordenação geral e consolidação das entregas |
| Arthur Costa | Designer de Experiência | Pesquisa com usuários, fluxos, wireframes e protótipo no Figma |
| **Leonardo Picanço Fontinele** | Desenvolvedor / Técnico | Arquitetura da solução, viabilidade técnica e desenvolvimento |
| Ana Jolly Garcia da Silva | Documentadora / Pesquisadora | Levantamento de dados, redação do projeto e quadro no Trello |
| Alvaro Ronaldy Santos | Desenvolvedor / Técnico | Arquitetura da solução, viabilidade técnica e desenvolvimento |
| Jamilly Barbosa da Costa | Documentadora / Pesquisadora | Levantamento de dados, redação do projeto e quadro no Trello |

**Orientador:** Instrutor Matheus S. Santos

---

## 11. 📊 Status do projeto

| Parte | Situação |
| :--- | :--- |
| Pesquisa, ideação e protótipo no Figma | ✅ Pronto |
| Telas do frontend (em modo demonstração, com dados no navegador) | ✅ Pronto |
| Base da API: login com JWT, permissões, envelope de resposta, catálogo de equipamentos | ✅ Pronto |
| Banco de dados modelado e testado (13 tabelas) | ✅ Pronto |
| Rotas de usuários, empréstimos, balcão, transferência e manutenção | 🚧 Em desenvolvimento |
| Módulo de insumos (tabelas e regras definidas) | 🚧 Em desenvolvimento |
| API gravando no PostgreSQL (hoje os dados ficam em memória) | 🚧 Em desenvolvimento |
| Frontend ligado à API | 🚧 Em desenvolvimento |
| Testes do ciclo completo e entrega | ⏳ A fazer |

A situação de cada rota está na coluna "Situação" de [`docs/contrato-api.md`](docs/contrato-api.md).

---

<p align="center"><sub>Projeto acadêmico desenvolvido no SENAI Macapá — Amapá</sub></p>
