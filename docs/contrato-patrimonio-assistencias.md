# Contrato para o backend: valor do patrimônio, perecíveis e assistências credenciadas

O front já funciona com estas regras no modo demonstração. Este documento diz o que a API precisa
aceitar e validar para que funcione igual com o banco de dados. **As regras valem nos dois lados:
o front valida para ajudar o usuário; a API valida porque é ela que garante.**

## 1. Equipamentos: `valorUnitario`

| Campo | Tipo | Regra |
|---|---|---|
| `valorUnitario` | `number` (R$, 2 casas) | Obrigatório no cadastro. `> 0` e `<= 1.000.000`. Opcional na edição. |

- `POST /equipamentos` e `PATCH /equipamentos/:id` passam a aceitar `valorUnitario`.
- Banco: `valor_unitario NUMERIC(12,2) NOT NULL CHECK (valor_unitario > 0)` (itens antigos: migrar com o valor da nota).
- Nunca usar `float` para dinheiro.

## 2. Insumos: `valorUnitario`, `perecivel` e validade

| Campo | Tipo | Regra |
|---|---|---|
| `valorUnitario` | `number` | Obrigatório, mesmas regras do equipamento. É o valor de UMA unidade de medida (um rolo, um litro). |
| `perecivel` | `boolean` | Obrigatório. |
| `validade` | `AAAA-MM-DD` | Obrigatória quando `perecivel = true` e não pode estar no passado no cadastro. |

- Entrada de **compra ou doação** de insumo perecível exige `validadeLote` (o front já bloqueia).
- A validade do estoque passa a ser a do lote que vence primeiro.

## 3. Baixa patrimonial: valor calculado pelo servidor

- `valorEstimado` **não vem mais do usuário**. O servidor calcula:
  `valorEstimado = equipamento.valorUnitario × manutencao.quantidade`.
- Se vier no corpo da requisição, deve ser **ignorado** (evita adulterar o valor da prestação de contas).
- O termo de baixa (`RegistroBaixa`) continua imutável depois de gerado.

## 4. Assistências técnicas credenciadas (novo recurso)

Rotas (somente admin):

| Método | Rota | O que faz |
|---|---|---|
| `GET` | `/assistencias?categoria=eletronico&emDia=true` | Lista; filtros opcionais |
| `POST` | `/assistencias` | Credencia |
| `PATCH` | `/assistencias/:id` | Edita dados ou renova o credenciamento |
| `PATCH` | `/assistencias/:id/ativa` | `{ "ativa": false }` descredencia (nunca apagar: o histórico aponta para ela) |

Campos (`AssistenciaTecnica`, em `frontend/src/app/core/models/assistencia.model.ts`):

| Campo | Regra |
|---|---|
| `nomeFantasia`, `razaoSocial` | Obrigatórios, mínimo 3 caracteres |
| `cnpj` | 14 dígitos, **dígitos verificadores válidos**, único |
| `telefone` | 10 ou 11 dígitos (com DDD) |
| `email` | E-mail válido |
| `especialidades` | Pelo menos uma `CategoriaEquipamento` |
| `credenciadaAte` | `AAAA-MM-DD`; no cadastro não pode estar vencida |
| `contrato`, `endereco` | Opcionais |

### Envio para conserto

`PATCH /manutencoes/:id` com `{ "acao": "assistencia", "assistenciaId": "..." }`. A API recusa quando:

1. a assistência está descredenciada (`ativa = false`);
2. o credenciamento venceu (`credenciadaAte < hoje`);
3. a categoria do equipamento não está nas `especialidades`.

A ocorrência guarda `assistenciaId` **e** o nome (para o histórico continuar legível mesmo se a
assistência mudar de nome depois).

## 5. Acessibilidade (sem backend)

- **VLibras**: widget oficial do Governo Federal, carregado de `https://vlibras.gov.br/app`. Se o
  servidor tiver CSP, liberar `script-src`, `connect-src`, `img-src` e `media-src` para `vlibras.gov.br`.
- **NVDA**: não exige instalação no servidor. O front anuncia cada troca de página e tem o link
  "Pular para o conteúdo"; o painel de Acessibilidade orienta o uso.

## Resolução parcial (conserto ou baixa de parte das unidades)

Uma ocorrência pode envolver várias unidades. Ao marcar como consertada/encontrada ou dar baixa,
a coordenação escolhe **quantas** e **quais** (etiqueta ou nº de série).

- `PATCH /manutencoes/:id/concluir` e `POST /manutencoes/:id/baixa` aceitam `quantidade` (1 a `quantidade` da ocorrência;
  padrão: todas) e `identificacao` (texto até 120 caracteres; **obrigatório** quando `quantidade` for menor que o total).
- Resolução parcial: o servidor cria uma ocorrência nova (protocolo próprio, `origemProtocolo` = protocolo da original,
  histórico copiado) só com as unidades resolvidas, e diminui a `quantidade` da original, que continua aberta.
- O valor da baixa usa a quantidade baixada: `valorUnitario × quantidade` (calculado no servidor).
- O estoque do equipamento muda só pelas unidades resolvidas.
