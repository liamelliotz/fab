# auth/ — proteção da API (guards e decorators)

Pasta da Fundação (Card 6). **Desde o merge deste card, TODA rota da API exige token Bearer.**
Lembre: todo `import` local termina em `.js`.

Import único: `import { Public, Roles, UsuarioAtual, type UsuarioAutenticado } from '../auth/decorators/index.js';`

## Como proteger (ou liberar) uma rota

| Quero… | Faço assim | Se falhar |
| --- | --- | --- |
| Rota só para logados | nada (é o padrão) | sem token ou token ruim: **401** |
| Rota aberta a todos | `@Public()` na rota (ou no controller) | — |
| Rota só do admin | `@Roles('admin')` na rota (ou no controller) | perfil errado: **403** |
| Saber quem está logado | `@UsuarioAtual()` no parâmetro | — |

```ts
@Controller('emprestimos')
export class EmprestimosController {
  @Get('meus')                                        // qualquer logado
  meus(@UsuarioAtual() usuario: UsuarioAutenticado) { // { sub, email, perfil }
    return this.service.listarDoUsuario(usuario.sub);
  }

  @Get()
  @Roles('admin')                                     // só admin
  listar() { /* … */ }

  @Get('publico')
  @Public()                                           // sem token
  publico() { /* … */ }
}
```

- `@UsuarioAtual('sub')` entrega só o id. O `sub` é o **id do usuário**.
- `@Roles` aceita `'admin'` ou `Perfil.Admin`, e vários perfis: `@Roles('admin', 'usuario')`.
  O `@Roles` da rota vale mais que o do controller. `@Public()` vale mais que `@Roles`.
- Os erros já saem no envelope: `{ sucesso: false, mensagem, dados: null, erros, timestamp }`.
- Teste pelo Swagger: **Authorize** no topo da página e cole só o token (sem a palavra `Bearer`).

## O que acontece em cada requisição

1. `JwtAuthGuard` (global): rota `@Public()` passa; as demais precisam de `Authorization: Bearer <token>`.
2. `JwtStrategy`: confere assinatura e validade e **busca o usuário de novo**. Conta apagada, `inativo` ou
   `bloqueado` dá 401, e o perfil usado é o de agora (não o que está dentro do token).
3. `RolesGuard` (global): confere o `@Roles()`. Perfil insuficiente dá 403.

## JWT

- `JWT_SECRET` e `JWT_EXPIRES_IN` vêm do `.env` (padrão de validade: `8h`).
- Em produção (`NODE_ENV=production`) o `JWT_SECRET` é obrigatório. Em desenvolvimento, sem ele, a API usa um
  segredo fixo e avisa no log.
- O `JwtService` já está configurado no `AuthModule`. O token carrega `JwtPayload`
  (`{ sub, email, perfil }`, em `strategies/jwt.strategy.ts`).
