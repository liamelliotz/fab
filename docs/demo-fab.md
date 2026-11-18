# FAB | Roteiro da demonstração integrada

**Ensaio completo pendente.** Execute este roteiro com frontend e backend ligados, usando um ambiente de teste. Na execução do E5 de 17/11, os cadastros de equipamento e insumo retornaram 404. Confirme essas operações na versão de apresentação antes de começar o ensaio.

## Preparação

1. Siga o [README da raiz](../README.md) e inicie o backend e o frontend em terminais separados. Anote o commit usado e o modo de persistência. Para mostrar que dados sobrevivem a reinícios, prepare um PostgreSQL de teste.
2. Abra o Swagger em <http://localhost:3000/api/docs>. Confira o login, as rotas de empréstimos e os cadastros de equipamento e insumo. Prepare um administrador, dois professores, um equipamento disponível e um insumo de teste.
3. Abra a interface e confirme no painel **Rede** que o login e as operações passam pela API. Prepare sessões separadas para os perfis ou troque de conta durante o ensaio.

## Sequência de apresentação

| O que mostrar | Ação | Resultado a conferir |
| --- | --- | --- |
| Solicitação e aprovação | Professor solicita um equipamento. Admin aprova em Solicitações. | Pedido aprovado e código de retirada disponível ao responsável. |
| Retirada no balcão | Admin consulta o código e confirma a entrega. | Pedido em andamento e código de devolução disponível. |
| Transferência | Professor responsável inicia a transferência. Segundo professor aceita. | Responsável e código de devolução mudam. Prazo de devolução é mantido. |
| Devolução e manutenção | Admin usa o novo código, informa avaria com observação e depois conclui a manutenção. | Linha do tempo registra os eventos do empréstimo. O equipamento volta ao estoque após a conclusão. |
| Saída de insumo no balcão | Selecione um insumo com saldo 5 e mínimo 2. Registre saída de 3 unidades com motivo. | Saldo 2, alerta de estoque baixo e item na lista a repor. |
| Histórico e previsão de término | Abra o histórico do insumo, filtre o período e consulte o relatório de consumo para o mesmo intervalo, incluindo a saída. | Movimento registrado, consumo e saldo atual visíveis. Confira a previsão retornada pelo backend quando houver consumo suficiente para calculá-la. |

Se a tela do insumo ainda estiver pendente, use a operação equivalente no Swagger para diagnosticar o backend e registre a tela como pendência do ensaio integrado. O contrato descreve os campos e as regras de cada operação. Consulte [contrato da API](contrato-api.md).

## Registro do ensaio

Registre data, commit, ambiente, resultado de cada etapa e links para as evidências. Marque o ensaio completo no Trello depois de executar da primeira à última etapa com a API ligada. Peça a uma pessoa de fora do grupo que instale a partir de um clone limpo usando o README e registre qualquer passo que precisou de ajuda.
