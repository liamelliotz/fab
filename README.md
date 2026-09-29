<div align="center">

# 🎒 FAB — Aprender, Organizar e Evoluir

![Angular](https://img.shields.io/badge/Angular-Frontend-DD0031?style=for-the-badge&logo=angular&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-Backend-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Language-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-LTS-339933?style=for-the-badge&logo=node.js&logoColor=white)
![SENAI](https://img.shields.io/badge/SENAI-MACAPÁ-0057B7?style=for-the-badge)
![Status](https://img.shields.io/badge/status-em_desenvolvimento-yellow?style=for-the-badge)

**Sistema web para gestão e controle do empréstimo de materiais e equipamentos escolares** (projetores, notebooks, kits de eletrônica, instrumentos de laboratório etc.), desenvolvido para a **Escola Estadual Mayra do Carmo**.

**Projeto Integrador** · Qualificação Profissional em Programador Full Stack
**Instituição:** SENAI — Centro de Formação Profissional de Macapá
**Equipe:** Team Rocket Projects · **Orientador:** Instrutor Matheus S. Santos

</div>

---

## 📌 Sumário

1. [Sobre o projeto](#1--sobre-o-projeto)
2. [Tecnologias](#2--tecnologias)
3. [Estrutura do repositório](#3--estrutura-do-repositório)
4. [Pré-requisitos](#4--pré-requisitos)
5. [Instalação das ferramentas por sistema operacional](#5--instalação-das-ferramentas-por-sistema-operacional)
6. [Clonando e executando o projeto](#6--clonando-e-executando-o-projeto)
7. [Como esta estrutura foi criada](#7--como-esta-estrutura-foi-criada)
8. [Fluxo de trabalho com Git](#8--fluxo-de-trabalho-com-git)
9. [Solução de problemas](#9--solução-de-problemas)
10. [Equipe](#10--equipe)
11. [Status do projeto](#11--status-do-projeto)

---

## 1. 🎯 Sobre o projeto

### O Problema

O empréstimo de equipamentos pedagógicos é feito de forma **totalmente manual**. Isso dificulta o controle de itens, prazos, responsáveis e devoluções, e gera falta de previsibilidade sobre a disponibilidade dos materiais — além de itens danificados ou indisponíveis sem registro prévio.

### A Solução

O **FAB** é um sistema digital (web e aplicativo) que oferece:

- 📋 Cadastro de materiais, equipamentos e usuários
- 🔎 Consulta de disponibilidade em tempo real
- 📅 Reserva antecipada de equipamentos
- 📦 Registro de retirada e devolução, com avaliação do estado de conservação do item
- 🕓 Histórico completo de movimentações e relatórios
- 🔔 Alertas automáticos para prazos de devolução

### Perfis de usuário

| Perfil | Responsabilidades |
| :--- | :--- |
| **Professor (solicitante)** | Consulta, reserva e acompanha seus empréstimos |
| **Administrador (responsável pelo patrimônio)** | Analisa solicitações, registra retiradas/devoluções e controla prazos e manutenção |

---

## 2. 🛠️ Tecnologias

| Camada | Tecnologia | Observação |
| :--- | :--- | :--- |
| **Frontend** | [Angular](https://angular.dev/) | Aplicação em `frontend/` |
| **Backend** | [NestJS](https://nestjs.com/) | API REST em `backend/` |
| **Linguagem** | TypeScript | Usada nas duas camadas |
| **Ambiente de execução** | [Node.js](https://nodejs.org/) | Versão LTS |
| **Controle de versão** | Git + GitHub | Branch principal: `main` |
| **Design / Protótipo** | Figma | Guia de estilos, fluxos e protótipo de alta fidelidade |
| **Gestão do projeto** | Trello | Quadro Kanban da equipe |

---

## 3. 📁 Estrutura do Repositório

```text
nome-da-solucao/
├── frontend/          # Aplicação Angular (interface do usuário)
├── backend/           # Aplicação NestJS (API)
├── .gitignore         # Arquivos e pastas ignorados pelo Git
└── README.md          # Documentação do projeto
```

> ℹ️ `frontend/` e `backend/` são projetos independentes, cada um com o próprio `package.json` e as próprias dependências (`node_modules`).

---

## 4. ⚙️ Pré-requisitos

### 4.1 Sistemas operacionais suportados

| Sistema | Versões recomendadas | Observação |
| :--- | :--- | :--- |
| **Windows** | Windows 10 (64 bits) ou Windows 11 | Recomendado usar o **Git Bash** ou o **PowerShell** |
| **macOS** | macOS 12 (Monterey) ou superior | Intel ou Apple Silicon |
| **Linux** | Ubuntu 22.04+ / Debian 12+ / Fedora 38+ (64 bits) | Outras distribuições modernas também funcionam |

### 4.2 Requisitos de hardware

| Recurso | Mínimo | Recomendado |
| :--- | :--- | :--- |
| Memória RAM | 4 GB | 8 GB ou mais |
| Espaço em disco livre | 2 GB | 5 GB ou mais |
| Processador | 64 bits, 2 núcleos | 4 núcleos ou mais |
| Internet | Necessária para instalar dependências e fazer push | Conexão estável |

> ⚠️ As dependências do Angular e do NestJS ocupam centenas de MB em `node_modules`. Em máquinas com pouca RAM, feche outros programas ao rodar o frontend.

### 4.3 Softwares necessários

| Software | Versão | Para que serve | Como verificar |
| :--- | :--- | :--- | :--- |
| **Node.js** | LTS atual (24.x) ou 22.12+ | Executa o Angular CLI, o Nest CLI e o backend | `node -v` |
| **npm** | Vem com o Node.js | Gerenciador de pacotes | `npm -v` |
| **Git** | 2.30 ou superior | Controle de versão | `git --version` |
| **Angular CLI** | Versão atual | Cria e executa o frontend (`ng`) | `ng version` |
| **Nest CLI** | Versão atual | Cria e executa o backend (`nest`) | `nest --version` |
| **Editor de código** | Qualquer (recomendado: VS Code) | Edição do código | — |
| **Conta no GitHub** | — | Repositório remoto | — |
| **Navegador moderno** | Chrome, Edge ou Firefox atualizados | Testar o frontend | — |

> ⚠️ **Importante sobre o Node.js:** o Angular exige versões específicas do Node. Versões antigas (como a 18) ou já encerradas (como a 20, cujo suporte terminou em abril de 2026) podem causar erro na criação ou execução do projeto. Use a **versão LTS mais recente** ou, no mínimo, a 22.12. Se `node -v` mostrar algo diferente, atualize antes de continuar.

### 4.4 Portas utilizadas

| Serviço | Porta padrão | Endereço |
| :--- | :--- | :--- |
| Frontend (Angular) | 4200 | `http://localhost:4200` |
| Backend (NestJS) | 3000 | `http://localhost:3000` |

Essas portas precisam estar livres — veja [Solução de problemas](#9--solução-de-problemas) caso estejam ocupadas.

---

## 5. 💻 Instalação das ferramentas por sistema operacional

### 5.1 Windows 10/11

**Opção A — pelo terminal (winget, já incluso no Windows 11 e nas versões recentes do Windows 10):**

```powershell
winget install OpenJS.NodeJS.LTS
winget install Git.Git
winget install Microsoft.VisualStudioCode
```

**Opção B — instaladores:** baixe o Node.js (LTS) em [nodejs.org](https://nodejs.org) e o Git em [git-scm.com/download/win](https://git-scm.com/download/win), seguindo o assistente com as opções padrão (marcando a opção de adicionar ao PATH).

Depois, **feche e abra novamente o terminal** e instale as CLIs:

```powershell
npm install -g @angular/cli @nestjs/cli
```

> ⚠️ Se o PowerShell bloquear o comando `ng` ou `nest` com a mensagem *"a execução de scripts foi desabilitada neste sistema"*, rode uma vez:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```
> Ou use o **Git Bash** ou o **Prompt de Comando (cmd)**, que não têm essa restrição.

### 5.2 macOS

Com o [Homebrew](https://brew.sh/) instalado:

```bash
brew install node git
npm install -g @angular/cli @nestjs/cli
```

Sem o Homebrew, use os instaladores oficiais em [nodejs.org](https://nodejs.org) e [git-scm.com](https://git-scm.com).

### 5.3 Linux (Ubuntu/Debian e derivados)

Evite o Node.js do repositório padrão da distribuição, que costuma ser antigo. Recomenda-se o **nvm** (Node Version Manager):

```bash
sudo apt update && sudo apt install -y git curl
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
# feche e abra o terminal, depois:
nvm install --lts
nvm use --lts
npm install -g @angular/cli @nestjs/cli
```

> ℹ️ Com o nvm, `npm install -g` não precisa de `sudo`. Se você instalou o Node de outra forma e receber erro `EACCES`, veja a seção de problemas.

### 5.4 Configuração inicial do Git (todos os sistemas)

Faça uma única vez, usando o nome e o e-mail cadastrados no GitHub:

```bash
git config --global user.name "Seu Nome Completo"
git config --global user.email "seu-email@exemplo.com"
git config --global init.defaultBranch main
```

### 5.5 Autenticação no GitHub

O GitHub não aceita senha da conta para `git push` por HTTPS. Escolha uma opção:

| Opção | Como funciona |
| :--- | :--- |
| **Git Credential Manager** | Já incluso no Git para Windows e no macOS via Homebrew — abre o navegador no primeiro `push` |
| **Personal Access Token (PAT)** | Criado em *GitHub → Settings → Developer settings → Personal access tokens*, usado no lugar da senha |
| **Chave SSH** | Alternativa avançada; usa a URL `git@github.com:usuario/repositorio.git` |

### 5.6 Verificando tudo

```bash
node -v
npm -v
git --version
ng version
nest --version
```

Todos os comandos devem responder sem erro.

---

## 6. ▶️ Clonando e Executando o Projeto

### 6.1 Clonar o repositório

```bash
git clone <URL_DO_REPOSITORIO>
cd <nome-da-pasta-do-repositorio>
```

### 6.2 Backend (NestJS)

```bash
cd backend
npm install
npm run start:dev
```

Acesse `http://localhost:3000` — a API deve responder com a mensagem padrão do NestJS (`Hello World!`). O modo `start:dev` reinicia o servidor automaticamente a cada alteração.

| Comando | O que faz |
| :--- | :--- |
| `npm run start` | Inicia sem recarga automática |
| `npm run build` | Compila para a pasta `dist/` |
| `npm run test` | Executa os testes unitários |
| `npm run lint` | Verifica o estilo do código |

### 6.3 Frontend (Angular)

Em **outro terminal**:

```bash
cd frontend
npm install
ng serve
```

Acesse `http://localhost:4200` — o navegador recarrega automaticamente a cada alteração. Para abrir direto no navegador: `ng serve --open`.

| Comando | O que faz |
| :--- | :--- |
| `ng build` | Gera a versão de produção em `dist/` |
| `ng test` | Executa os testes unitários |
| `ng generate component nome` | Cria um novo componente |

> ℹ️ Deixe os **dois terminais abertos ao mesmo tempo** para rodar frontend e backend juntos.

---

## 7. 🏗️ Como esta estrutura foi criada

Registro dos passos usados na criação inicial (etapa de estrutura do projeto):

```bash
# 1. Pasta raiz e repositório local
mkdir nome-da-solucao && cd nome-da-solucao
git init -b main

# 2. Frontend (Angular) – sem criar um .git interno, sem SSR
ng new frontend --skip-git --style=css --ssr=false

# 3. Backend (NestJS) – sem criar um .git interno
nest new backend --skip-git --package-manager npm

# 4. Arquivos de raiz: .gitignore e README.md (este arquivo)

# 5. Commit inicial e conexão com o repositório remoto
git add .
git commit -m "chore: estrutura inicial (Angular + NestJS), .gitignore e README"
git remote add origin <URL_DO_REPOSITORIO>
git push -u origin main
```

> ⚠️ O parâmetro `--skip-git` é essencial: sem ele, cada CLI cria um repositório Git próprio dentro da pasta, e o GitHub passa a exibir `frontend` e `backend` como pastas vazias.

---

## 8. 🔀 Fluxo de Trabalho com Git

### 8.1 Branches

| Branch | Uso |
| :--- | :--- |
| `main` | Versão estável do projeto — **não trabalhar diretamente nela** após a estrutura inicial |
| `feature/nome-da-funcionalidade` | Novas funcionalidades (ex.: `feature/login`) |
| `fix/nome-do-erro` | Correções (ex.: `fix/status-do-equipamento`) |

### 8.2 Ciclo básico de trabalho

```bash
git checkout main
git pull origin main                 # atualiza o código local
git checkout -b feature/minha-tarefa # cria a branch da tarefa
# ... edite o código ...
git add .
git commit -m "feat: descreve o que foi feito"
git push -u origin feature/minha-tarefa
# abra um Pull Request no GitHub e peça revisão de outro integrante
```

### 8.3 Padrão de mensagens de commit

| Prefixo | Uso |
| :--- | :--- |
| `feat:` | Nova funcionalidade |
| `fix:` | Correção de erro |
| `docs:` | Alteração em documentação |
| `style:` | Ajustes visuais ou de formatação, sem mudar a lógica |
| `refactor:` | Reorganização de código |
| `chore:` | Configuração e tarefas de manutenção |

### 8.4 Boas práticas

- ✅ Faça `git pull` antes de começar a trabalhar
- ✅ Faça commits pequenos e com mensagens claras
- 🚫 Nunca envie senhas, tokens ou arquivos `.env` (o `.gitignore` já ignora `.env`)
- 🚫 Não envie `node_modules/` nem `dist/` (também ignorados)

---

## 9. 🧯 Solução de Problemas

| Problema | Causa provável | Solução |
| :--- | :--- | :--- |
| `node`, `ng` ou `nest` "não é reconhecido como comando" | Node ou CLIs não instalados, ou terminal aberto antes da instalação | Reinstale, feche e abra o terminal e rode `npm install -g @angular/cli @nestjs/cli` |
| `ng new` reclama da versão do Node | Node fora da faixa suportada pelo Angular | Atualize para a versão LTS atual (`node -v` para conferir) |
| PowerShell: *"execução de scripts desabilitada"* | Política de execução do Windows | `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` ou use o Git Bash |
| `EACCES: permission denied` ao instalar globalmente (Linux/macOS) | Node instalado em pasta do sistema | Instale o Node via **nvm** ou configure um diretório global do npm no seu usuário; evite `sudo npm` |
| `Port 4200 is already in use` | Outro processo usando a porta | Feche o outro processo ou use `ng serve --port 4300` |
| `EADDRINUSE :::3000` | Porta 3000 ocupada | Feche o processo que a usa ou altere a porta em `backend/src/main.ts` |
| `frontend` e `backend` aparecem vazias no GitHub | Existe um `.git` dentro dessas pastas | Apague `frontend/.git` e `backend/.git`, depois `git rm -r --cached frontend backend`, `git add .` e faça novo commit |
| `git push` recusado (*rejected / fetch first*) | O repositório remoto já tem commits (README ou licença criados no GitHub) | `git pull origin main --allow-unrelated-histories`, resolva o conflito e faça o push novamente |
| `remote origin already exists` | O remoto já foi adicionado | `git remote set-url origin <URL_DO_REPOSITORIO>` |
| Autenticação falhou no push | Senha da conta não é mais aceita | Use o Git Credential Manager, um Personal Access Token ou SSH |
| Erros estranhos após `npm install` | Instalação corrompida | Apague `node_modules` e `package-lock.json` da pasta e rode `npm install` novamente |
| Quebras de linha diferentes entre Windows e Linux | Configuração do Git | `git config --global core.autocrlf true` (Windows) |

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

## 11. 📊 Status do Projeto

- [x] Pesquisa, ideação e protótipo de alta fidelidade no Figma
- [x] Estrutura inicial do repositório (Angular + NestJS)
- [ ] Modelagem do banco de dados
- [ ] Implementação da API (autenticação, materiais, empréstimos)
- [ ] Implementação das telas do frontend
- [ ] Integração frontend + backend
- [ ] Testes e validação final

---

<p align="center"><sub>Projeto acadêmico desenvolvido no SENAI Macapá — Amapá</sub></p>