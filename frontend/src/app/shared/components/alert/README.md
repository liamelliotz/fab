
# Sistema de Notificações — FAB

O sistema de notificações fornece mensagens visuais reutilizáveis
para informar o usuário sobre operações realizadas no frontend.

## Tipos disponíveis

- `sucesso(mensagem, duracao?)`: confirma uma operação concluída.
- `erro(mensagem, duracao?)`: informa uma falha.
- `aviso(mensagem, duracao?)`: apresenta um alerta preventivo.
- `info(mensagem, duracao?)`: exibe uma informação.

A duração é informada em milissegundos. Os valores padrão são
5 segundos para sucesso, aviso e informação, e 7 segundos para erro.
Use `0` para manter a notificação visível até o fechamento manual.

## Exemplo de sucesso

```typescript
import { inject } from '@angular/core';
import { NotificationService } from
  '../../../core/services/notification.service';

private readonly notificacoes = inject(NotificationService);

salvar(): void {
  this.notificacoes.sucesso('Equipamento cadastrado com sucesso!');
}
```

## Exemplo de erro

```typescript
this.notificacoes.erro(
  'Não foi possível cadastrar o equipamento.',
);
```

## Fechamento manual

```typescript
this.notificacoes.fechar(id);
```

Para limpar todas as notificações, utilize `limpar()`.

## Integração

O componente `app-alert` é registrado uma única vez no componente
raiz da aplicação. As telas utilizam o `NotificationService`
por injeção de dependência.

A implementação funciona independentemente do backend. A chamada
do serviço deve ser feita pelas telas quando uma operação tiver
sucesso ou falhar.

Observação: a substituição dos `alert()` existentes nas telas
é responsabilidade de cada integrante, conforme a divisão dos cards.
