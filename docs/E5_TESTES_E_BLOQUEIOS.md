# E5 — Testes dos ciclos completos

Responsável: Jamilly. Revisora: Ana Jolly.

## Situação

Implementação dos cenários e configuração de CI preparada. **Card bloqueado pelas dependências; não concluído.** Os cenários foram escritos conforme o contrato e não substituem rotas ausentes por mocks. As etapas posteriores ao primeiro erro ainda precisam ser executadas quando os módulos estiverem disponíveis.

## Verificação desta entrega — 17/11/2026

| Verificação | Resultado |
| --- | --- |
| Build do backend | Aprovado |
| Lint do backend | Aprovado |
| TypeScript, incluindo testes | Aprovado |
| Integração em memória | 17 aprovados, 2 falharam, 7 ignorados pela configuração existente |
| Ciclo completo | Falhou: POST /api/equipamentos retornou 404; esperado 201 |
| Ciclo de insumos | Falhou: POST /api/insumos retornou 404; esperado 201 |
| PostgreSQL local | Não executado: ambiente sem PostgreSQL/Docker disponível |
| GitHub Actions | Não executado nesta entrega; requer publicação da branch |

## Conteúdo

- Ciclo de empréstimo: usuários próprios, material próprio, solicitação, aprovação, retirada, transferência aceita, devolução com avaria, manutenção e reconciliação do estoque. Confere códigos utilizados, responsável e eventos da linha do tempo.
- Ciclo de insumos: cadastro, entrada, saída até o mínimo, recusa por saldo insuficiente, reposição, histórico filtrado e relatório de consumo.
- Cada cenário cria sua aplicação e seus dados. No PostgreSQL, cria um schema exclusivo, executa migrations e seed nesse schema e o remove ao final. Verifica também as linhas persistidas para detectar fallback em memória. Essa estratégia ainda depende de validação real no PostgreSQL.
- O script PostgreSQL compila, executa migrations e seed (as etapas do db:reset) e roda a suíte com PERSISTENCIA=postgres. Exige E5_DATABASE_URL apontando explicitamente para banco dedicado com nome terminado em _test.
- CI com serviço postgres:16. Os erros dos ciclos permanecem visíveis: a configuração não ignora dependências ausentes.

## Como testar

Na pasta backend, para memória:

```cmd
npm.cmd ci
npm.cmd run build
npm.cmd run lint
npm.cmd run test:e2e:ciclos
```

No código recebido, os dois ciclos falham nos pontos registrados acima. Para a suíte completa: npm.cmd run test:e2e.

Somente depois de disponibilizar um banco PostgreSQL **exclusivo e descartável para testes**, configurar E5_DATABASE_URL com sua URL e executar npm.cmd run test:e2e:postgres. Esse comando apaga/recria dados de seed no banco indicado. Não usar um banco de desenvolvimento compartilhado. Docker não é obrigatório se já existir PostgreSQL dedicado acessível. O CI fornece seu próprio banco descartável.

## Rascunhos de cards de correção

Estes textos estão prontos para cadastrar no Trello; nenhum card externo foi criado automaticamente. Confirmar os responsáveis no quadro.

### Equipamentos — cadastro necessário ao ciclo E5 retorna 404

Responsável: dono do módulo Equipamentos, conforme quadro.

Reprodução: executar test:e2e:ciclos; o cenário de empréstimo autentica o administrador, cria professores e tenta cadastrar equipamento próprio. POST /api/equipamentos retorna 404 em vez de 201. O controller recebido expõe apenas consultas. Implementar o cadastro conforme contrato, incluindo persistência PostgreSQL, para permitir dados independentes no teste.

### Insumos — cadastro necessário ao ciclo E5 retorna 404

Responsável: dono do módulo Insumos, conforme quadro.

Reprodução: executar test:e2e:ciclos; o cenário de insumos autentica o administrador e cadastra item próprio. POST /api/insumos retorna 404 em vez de 201. O controller recebido não expõe as operações do contrato. Disponibilizar o ciclo e sua persistência conforme dependências do card.

## Dependências ainda não alcançadas em execução

A inspeção do código recebido encontrou controllers de Empréstimos e Manutenções sem operações, além da persistência de Equipamentos ainda em memória. Isso indica bloqueios adicionais para o ciclo real; não são etapas aprovadas nem falhas HTTP observadas pelo cenário, que parou antes. Conferir a integração de B3, C7 e D7 e dos módulos exigidos pelo contrato com os responsáveis.

## Para concluir

- Integrar as dependências e corrigir os bloqueios.
- Executar ambos os cenários em memória e PostgreSQL local, inclusive em execução individual e ordem invertida.
- Conferir os jobs no GitHub e registrar os links das execuções.
- Cadastrar as falhas no quadro e registrar seus links.
- Solicitar revisão somente com os resultados reais, mantendo as pendências explícitas.
