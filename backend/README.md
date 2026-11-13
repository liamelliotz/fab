# common/ — padrões que todos os módulos usam

Pasta da Fundação (Cards 2 e 3). **Não edite sem avisar no card**: todos os módulos dependem dela.
Lembre: todo `import` local termina em `.js`.

## 1. Envelope de resposta (automático)

Controllers e services devolvem **só o dado**. O `ResponseInterceptor` monta o envelope:

```json
{ "sucesso": true, "mensagem": "…", "dados": { }, "erros": [], "timestamp": "2026-10-21T10:00:00.000Z" }
```

Para colocar uma mensagem no sucesso, use `@Mensagem()`:

```ts
import { Mensagem } from '../common/interceptors/mensagem.decorator.js';

@Post()
@Mensagem('Equipamento cadastrado com sucesso')
criar(@Body() dto: CriarEquipamentoDto) {
  return this.equipamentosService.criar(dto); // devolve só o equipamento
}
```

## 2. Erros (automático)

Lance as exceções do Nest. O `HttpExceptionFilter` devolve `{ sucesso: false, mensagem, dados: null, erros, timestamp }`:

```ts
throw new NotFoundException('Equipamento não encontrado');            // 404
throw new ConflictException('Já existe um equipamento com este código'); // 409
throw new ForbiddenException('Você só pode ver os seus pedidos');     // 403
```

- Erro de validação do DTO vira **400**, com `mensagem: "Dados inválidos"` e uma frase por campo em `erros`
  (já traduzidas, por exemplo: `"nome não pode ficar vazio"`).
- Erro inesperado vira **500** com texto genérico (o detalhe vai só para o log).
- Para uma lista de erros própria: `new BadRequestException({ message: 'Resumo', erros: ['…', '…'] })`.

## 3. Paginação

Estenda o `PaginacaoDto` no DTO de filtro da rota (`?pagina=1&itensPorPagina=10`; padrão 1 e 10, máximo 100):

```ts
import { PaginacaoDto, paginarLista } from '../common/dto/index.js';

export class FiltroEquipamentoDto extends PaginacaoDto {
  @IsOptional() @IsString() busca?: string;
}

@Get()
listar(@Query() filtro: FiltroEquipamentoDto) {
  const filtrados = this.repositorio.listar().filter(/* … */);
  return paginarLista(filtrados, filtro); // lista completa em memória -> página pronta
}
```

Quando a consulta já devolve só a página, use `montarPagina(itensDaPagina, totalGeral, filtro)`.
A resposta é `{ itens, totalItens, paginaAtual, totalPaginas, itensPorPagina, temProxima, temAnterior }`.

## 4. Enums

Valores idênticos aos do front (`core/models`). Use em DTOs e entidades:

```ts
import { StatusEmprestimo } from '../common/enums/index.js';

@IsEnum(StatusEmprestimo) status: StatusEmprestimo;
```

Disponíveis: `Perfil`, `StatusUsuario`, `CategoriaEquipamento`, `StatusEquipamento`, `StatusEmprestimo`, `StatusManutencao`.

## 5. Repositório em memória (acesso a dados)

Os services falam com o repositório, nunca com o armazenamento. Hoje os dados ficam na memória e
**somem ao reiniciar a API** (o seed recria tudo); depois a implementação troca para PostgreSQL e os services não mudam.
Os métodos são assíncronos: use `await`.

```ts
import { InMemoryRepository } from '../common/repository/index.js';

@Injectable()
export class EquipamentosRepository extends InMemoryRepository<Equipamento> {
  protected override dadosIniciais(): Equipamento[] {
    return EQUIPAMENTOS_SEED;               // seed do próprio módulo (ver item 6)
  }

  buscarPorCodigoPatrimonio(codigo: string) { // consulta específica do módulo
    const alvo = codigo.trim().toLowerCase();
    return this.encontrar((e) => e.codigoPatrimonio.trim().toLowerCase() === alvo);
  }
}
```

| Método | O que faz |
| --- | --- |
| `criar(dados)` | Guarda; sem `id`, gera um UUID. Devolve o registro salvo |
| `buscarPorId(id)` | Devolve o registro ou `null` (o **service** lança o 404) |
| `listar()` | Todos, na ordem de criação (filtros e paginação ficam no service) |
| `atualizar(id, parcial)` | Muda só os campos informados; devolve o registro ou `null` |
| `remover(id)` | `true` se apagou, `false` se não existia |
| `contar()` | Quantidade de registros |
| `encontrar(fn)` / `filtrar(fn)` | Auxiliares `protected` para as consultas do módulo |
| `redefinir()` | Apaga tudo e recarrega o seed (útil nos testes) |

O repositório devolve **cópias**: alterar o objeto recebido não muda o que está guardado, é preciso chamar `atualizar()`.
Registre o repositório em `providers` (e em `exports`, se outro módulo for usá-lo).

## 6. Seed (dados de exemplo)

- Cada módulo tem o **próprio** `<modulo>.seed.ts` e só o repositório dele carrega os dados (no `onModuleInit`).
- Um seed **não importa o seed de outro módulo**. Para apontar para registros alheios, use os ids de `common/seed/ids.ts`
  (`USUARIO_IDS`, `EQUIPAMENTO_IDS`, `EMPRESTIMO_IDS`): o id é o mesmo em qualquer lugar, sem esperar o merge do colega.
- Todo item do seed tem `id` fixo. Datas de seed: use valores relativos a hoje (ex.: hoje + 7 dias).
- Usuários de exemplo (`usuarios.seed.ts`): `admin@fab.com` / `admin123` e `professor@fab.com` / `prof123`, mais os
  quatro solicitantes dos pedidos de exemplo. A senha está em texto só no seed: o hash é gerado no Card 4.

## Utilitários (`common/utils`) e configuração

- `data.util.ts`: `hojeIso()`, `paraIso()`, `somarDias()`, `diferencaEmDias()`, `ehDataIso()`. **Sempre use `hojeIso()` para saber o dia de hoje**:
  ele respeita o fuso da escola (`APP_TIMEZONE`), e não o do servidor. Nunca use `new Date().toISOString().slice(0, 10)`.
- `codigo.util.ts`: `gerarCodigo()`, `normalizarCodigo()` e `montarPayloadQr()` (códigos de retirada e devolução).
- `configurar-app.ts`: prefixo `/api`, helmet, validação e envelope. O `main.ts` e os testes e2e chamam a mesma função.
- `enums/insumo.enum.ts`: categorias, unidades, tipos e motivos de movimentação de insumos.

## Banco de dados (`common/database`)

| Arquivo | Para quê |
| --- | --- |
| `persistencia.ts` | `lerModoPersistencia()`: `memoria` (padrão) ou `postgres`, lido da variável `PERSISTENCIA` |
| `database.module.ts` | `DatabaseModule.forRoot()` (já registrado no `app.module.ts`, só conecta com `PERSISTENCIA=postgres`) e `entidadesDoBanco()` |
| `provedor-de-repositorio.ts` | `provedorDeRepositorio()`: entrega a versão em memória ou a do banco com o mesmo token |
| `erro-de-conexao.ts` | traduz os erros do PostgreSQL para português (usado pela API e pelos scripts `db:*`) |

Regras fixas: `synchronize` é sempre `false` (as tabelas vêm de `database/migrations`), e os testes unitários
sempre rodam em memória. Para testar com o banco: `npm run test:e2e:postgres`.

### Como levar um repositório para o banco (cards A2, B3, C7 e D7)

O exemplo usa usuários. Troque pelos nomes do seu módulo.

1. **Entidade do banco.** Crie `usuarios/orm/usuario.orm-entity.ts` com `@Entity('usuarios')`, mapeando
   cada coluna da migration. Dê o nome da coluna e o tipo em todo `@Column`, porque o banco usa
   snake_case e o código usa camelCase:

   ```ts
   import { Column, Entity, PrimaryColumn } from 'typeorm';

   @Entity('usuarios')
   export class UsuarioOrm {
     @PrimaryColumn({ type: 'text' })
     id!: string;

     @Column({ name: 'senha_hash', type: 'text' })
     senhaHash!: string;

     @Column({ name: 'criado_em', type: 'timestamptz' })
     criadoEm!: Date;
   }
   ```

   Colunas `NUMERIC` chegam como texto: converta com `Number()`. Datas `DATE` chegam como `AAAA-MM-DD`.
   Não crie tabela nem coluna pela entidade: se faltar algo, peça ao Leonardo uma migration nova.

2. **Repositório do banco.** Crie `usuarios/usuarios.postgres.repository.ts` com **os mesmos métodos
   públicos** do repositório em memória (mesmos nomes, parâmetros e retornos). Escreva duas funções
   pequenas, `paraEntidade(linha)` e `paraLinha(entidade)`, e use-as em todos os métodos:

   ```ts
   import { Inject, Injectable } from '@nestjs/common';
   import { InjectRepository } from '@nestjs/typeorm';
   import { Repository } from 'typeorm';
   import { UsuarioOrm } from './orm/usuario.orm-entity.js';

   @Injectable()
   export class UsuariosPostgresRepository {
     constructor(
       @InjectRepository(UsuarioOrm) private readonly tabela: Repository<UsuarioOrm>,
     ) {}

     async buscarPorId(id: string) {
       const linha = await this.tabela.findOneBy({ id });
       return linha ? paraEntidade(linha) : null;
     }
     // ... os demais métodos, com a mesma assinatura da versão em memória
   }
   ```

3. **Registro no módulo.** Registre a entidade com `entidadesDoBanco()` e troque o repositório em
   memória da lista de `providers` pelo `provedorDeRepositorio()`:

   ```ts
   import { entidadesDoBanco, provedorDeRepositorio } from '../common/database/index.js';

   @Module({
     imports: [...entidadesDoBanco([UsuarioOrm])],
     providers: [
       UsuariosService,
       provedorDeRepositorio(UsuariosRepository, UsuariosPostgresRepository),
     ],
   })
   ```

   O service **não muda**: ele continua pedindo `@Inject(UsuariosRepository)`. Não use
   `TypeOrmModule.forFeature` direto: ele exige o banco e quebraria a API em memória.
   O `entidadesDoBanco()` só registra as tabelas quando `PERSISTENCIA=postgres`.

4. **Erros do banco viram HTTP.** Violação de índice único (código `23505`) vira `ConflictException`
   (409). Violação de `CHECK` (código `23514`) vira 409 com a regra em português. Nunca deixe o erro do
   banco chegar cru ao cliente (vira 500).

5. **Duas ou mais tabelas na mesma operação** rodam em transação:
   `this.tabela.manager.transaction(async (m) => { ... })`.

6. **Testes.** Os testes em memória continuam iguais e precisam passar. Crie
   `test/<modulo>.postgres.e2e-spec.ts` com `describe.skipIf(lerModoPersistencia() !== 'postgres')` (veja
   `test/banco.e2e-spec.ts`) e rode com o banco no ar:

   ```bash
   npm run db:reset
   npm run test:e2e:postgres
   ```
